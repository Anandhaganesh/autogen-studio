import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

// Helper to wait
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Scrapes businesses from Google Maps based on query and location
 */
export async function scrapeGoogleMaps(keyword, location, limit = 5, onProgress = () => {}) {
  const searchQuery = `${keyword} in ${location}`;
  onProgress(`Launching browser for Google Maps search: "${searchQuery}"`);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  const leads = [];

  try {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
    onProgress(`Navigating directly to Google Maps search query: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    
    // Check for cookie consent overlay and click Agree/Accept
    const consentButtons = [
      'button[aria-label="Accept all"]',
      'button[aria-label="Agree"]',
      'button:has-text("Accept all")',
      'button:has-text("Agree")',
      'form[action*="consent.google"] button'
    ];
    for (const selector of consentButtons) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          onProgress(`Found cookie consent popup. Clicking consent button: ${selector}`);
          await btn.click();
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null);
          break;
        }
      } catch (e) {}
    }
    
    onProgress('Waiting for search results listings...');
    
    // Wait for at least one listing link containing maps/place or wait a brief moment
    await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 }).catch(() => {
      onProgress('Could not find listing links. Trying fallback wait...');
    });
    
    // Scroll listings side panel to load more dynamic entries
    onProgress('Loading business listings...');
    let scrollCount = 0;
    
    // Find the scrolling container (div[role="feed"] or similar list columns)
    const feedSelector = 'div[role="feed"]';
    
    while (scrollCount < 6) {
      const feed = await page.$(feedSelector);
      if (feed) {
        await feed.evaluate(node => node.scrollBy(0, 1500));
      } else {
        await page.evaluate(() => window.scrollBy(0, 1000));
      }
      await delay(1500);
      
      const content = await page.content();
      if (content.includes("You've reached the end of the list")) {
        onProgress('Reached end of listings on Google Maps.');
        break;
      }
      scrollCount++;
    }
    
    // Extract listing detail links
    // Businesses typically are list items containing links with "/maps/place/" in their href
    const listItems = await page.$$eval('a', anchors => {
      return anchors
        .filter(a => a.href && a.href.includes('/maps/place/'))
        .map(a => ({
          name: a.getAttribute('aria-label') || '',
          mapsUrl: a.href
        }));
    });
    
    // Deduplicate listings
    const uniqueListings = [];
    const seenUrls = new Set();
    for (const item of listItems) {
      if (item.name && item.mapsUrl && !seenUrls.has(item.mapsUrl)) {
        seenUrls.add(item.mapsUrl);
        uniqueListings.push(item);
      }
    }
    
    onProgress(`Found ${uniqueListings.length} listing links. Scraping details for the top ${Math.min(uniqueListings.length, limit)} items...`);
    
    // For each listing, navigate and scrape details (rating, website, phone, address)
    for (let i = 0; i < Math.min(uniqueListings.length, limit); i++) {
      const item = uniqueListings[i];
      onProgress(`[${i+1}/${limit}] Fetching details for: "${item.name}"`);
      
      const detailPage = await browser.newPage();
      try {
        await detailPage.goto(item.mapsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Wait for main container
        await detailPage.waitForSelector('h1', { timeout: 10000 }).catch(() => {});
        
        const lead = {
          name: item.name,
          mapsUrl: item.mapsUrl,
          website: '',
          phone: '',
          rating: null,
          reviewsCount: 0,
          address: ''
        };
        
        // Rating
        const ratingText = await detailPage.$eval('div.F7nice span[aria-hidden="true"]', el => el.textContent.trim()).catch(() => null);
        if (ratingText) {
          lead.rating = parseFloat(ratingText);
        }
        
        // Reviews Count
        const reviewsText = await detailPage.$eval('div.F7nice span[aria-label*="reviews"]', el => el.textContent.trim()).catch(() => null);
        if (reviewsText) {
          const digits = reviewsText.replace(/\D/g, '');
          if (digits) lead.reviewsCount = parseInt(digits, 10);
        }
        
        // Website link (data-item-id="authority")
        const websiteHref = await detailPage.$eval('a[data-item-id="authority"]', el => el.getAttribute('href')).catch(() => null);
        if (websiteHref) {
          lead.website = websiteHref;
        }
        
        // Phone number (button data-item-id^="phone:tel:")
        const phoneAttr = await detailPage.$eval('button[data-item-id^="phone:tel:"]', el => el.getAttribute('data-item-id')).catch(() => null);
        if (phoneAttr) {
          lead.phone = phoneAttr.replace('phone:tel:', '').trim();
        } else {
          // Fallback: aria-label starts with "Phone:"
          const phoneLabel = await detailPage.$eval('button[aria-label^="Phone:"]', el => el.getAttribute('aria-label')).catch(() => null);
          if (phoneLabel) {
            lead.phone = phoneLabel.replace('Phone:', '').trim();
          }
        }
        
        // Address (button data-item-id="address" or aria-label starts with "Address:")
        const addressText = await detailPage.$eval('button[data-item-id="address"]', el => el.textContent.trim()).catch(() => null);
        if (addressText) {
          lead.address = addressText;
        } else {
          const addressLabel = await detailPage.$eval('button[aria-label^="Address:"]', el => el.getAttribute('aria-label')).catch(() => null);
          if (addressLabel) {
            lead.address = addressLabel.replace('Address:', '').trim();
          }
        }
        
        leads.push(lead);
      } catch (err) {
        onProgress(`Failed to load details page for: "${item.name}"`);
        console.error(err);
        // Add basic lead even if details scrape failed
        leads.push({
          name: item.name,
          mapsUrl: item.mapsUrl,
          website: '',
          phone: '',
          rating: null,
          reviewsCount: 0,
          address: ''
        });
      } finally {
        await detailPage.close();
      }
    }
    
  } catch (error) {
    onProgress(`Maps scraping aborted due to error: ${error.message}`);
    console.error('[Google Maps Scraper Error]', error);
  } finally {
    await browser.close();
  }
  
  onProgress(`Scraping completed. Extracted ${leads.length} leads.`);
  return leads;
}

/**
 * Visits a lead's website to perform pixel checklist and SEO diagnostics.
 * Saves a screenshot of the home page.
 */
export async function auditWebsite(url, screenshotDir, leadId, onProgress = () => {}) {
  // Normalize URL
  let targetUrl = url;
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }
  
  onProgress(`Starting Playwright audit on website: ${targetUrl}`);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  const auditResult = {
    speed: 'slow',
    pixels: {
      facebook: false,
      googleAnalytics: false,
      tiktok: false
    },
    seo: {
      hasMetaDescription: false,
      hasH1: false,
      hasOpenGraph: false,
      title: '',
      metaDescription: '',
      h1Text: ''
    },
    contactEmail: ''
  };
  
  try {
    const startTime = Date.now();
    onProgress('Navigating to website...');
    
    // Visit website
    await page.goto(targetUrl, { waitUntil: 'load', timeout: 25000 });
    const loadTimeMs = Date.now() - startTime;
    
    onProgress(`Page loaded in ${(loadTimeMs / 1000).toFixed(2)}s`);
    
    if (loadTimeMs < 2500) {
      auditResult.speed = 'fast';
    } else if (loadTimeMs < 5500) {
      auditResult.speed = 'average';
    } else {
      auditResult.speed = 'slow';
    }
    
    // Ensure screenshot directory exists
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    // Screenshot
    const screenshotName = `lead-${leadId}.png`;
    const screenshotPath = path.join(screenshotDir, screenshotName);
    onProgress(`Capturing homepage screenshot: ${screenshotName}...`);
    await page.screenshot({ path: screenshotPath, timeout: 10000 });
    
    // SEO audits
    auditResult.seo.title = await page.title().catch(() => '');
    
    // Meta Description
    const metaDesc = await page.$eval('meta[name="description"]', el => el.getAttribute('content')).catch(() => null);
    if (metaDesc) {
      auditResult.seo.hasMetaDescription = true;
      auditResult.seo.metaDescription = metaDesc;
    }
    
    // H1 Heading
    const h1Text = await page.$eval('h1', el => el.textContent.trim()).catch(() => null);
    if (h1Text) {
      auditResult.seo.hasH1 = true;
      auditResult.seo.h1Text = h1Text;
    }
    
    // OpenGraph check
    const ogTag = await page.$('meta[property^="og:"]').catch(() => null);
    if (ogTag) {
      auditResult.seo.hasOpenGraph = true;
    }
    
    // Pixel / Analytics Check
    onProgress('Scanning HTML scripts for tracking pixels...');
    const scripts = await page.$$eval('script', tags => {
      return tags.map(t => (t.src || '') + ' ' + (t.textContent || ''));
    });
    
    const combinedScripts = scripts.join(' ').toLowerCase();
    
    if (combinedScripts.includes('connect.facebook.net') || combinedScripts.includes('fbevents.js') || combinedScripts.includes('fbq(')) {
      auditResult.pixels.facebook = true;
    }
    if (combinedScripts.includes('googletagmanager.com') || combinedScripts.includes('google-analytics.com') || combinedScripts.includes('analytics.js') || combinedScripts.includes('gtag(')) {
      auditResult.pixels.googleAnalytics = true;
    }
    if (combinedScripts.includes('tiktok.com') || combinedScripts.includes('ttq.load(')) {
      auditResult.pixels.tiktok = true;
    }
    
    // Email Scraper
    onProgress('Scanning page content for contact emails...');
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailsFound = bodyText.match(emailRegex);
    if (emailsFound && emailsFound.length > 0) {
      // Deduplicate and filter out obvious generic assets if multiple
      const uniqueEmails = [...new Set(emailsFound)];
      auditResult.contactEmail = uniqueEmails[0];
      onProgress(`Found contact email: ${auditResult.contactEmail}`);
    } else {
      // Try scanning mailto links
      const mailtoHref = await page.$eval('a[href^="mailto:"]', el => el.getAttribute('href')).catch(() => null);
      if (mailtoHref) {
        auditResult.contactEmail = mailtoHref.replace('mailto:', '').split('?')[0].trim();
        onProgress(`Found contact email in mailto link: ${auditResult.contactEmail}`);
      }
    }
    
    onProgress('Website audit successfully completed.');
    
  } catch (error) {
    onProgress(`Audit error: ${error.message}`);
    console.error('[Website Audit Error]', error);
  } finally {
    await browser.close();
  }
  
  return auditResult;
}
