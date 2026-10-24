const TARGET_URL = "https://www.instagram.com/accounts/hide_story_and_live_from/";

// Listen for updates from the injection script
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "updateCount") {
    document.getElementById('hiddenCount').innerText = request.count;
  }
});

document.getElementById('goToSettings').addEventListener('click', () => {
  chrome.tabs.create({ url: TARGET_URL });
});

document.getElementById('clickAll').addEventListener('click', () => {
  executeScriptOnTab('click');
});

document.getElementById('unclickAll').addEventListener('click', () => {
  executeScriptOnTab('unclick');
});

async function executeScriptOnTab(mode) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.includes("instagram.com/accounts/hide_story_and_live_from")) {
    alert("Please click 'Open Settings Page' first!");
    return;
  }
  
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: automationEngine,
    args: [mode]
  });
}

async function automationEngine(mode) {
  const DEFAULT_GRAY = "rgb(219, 219, 219)";
  let count = 0;
  let lastHeight = 0;
  let noChangeCount = 0;

  const SELECTOR = '[aria-label="Toggle checkbox"][role="button"]';

  // On-page status card (the popup closes when the page gets focus).
  // Matches Instagram's current light/dark theme via the page background.
  const bg = window.getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [255, 255, 255];
  const isDark = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) < 128;
  const theme = isDark
    ? { bg: '#262626', fg: '#f5f5f5', sub: '#a8a8a8', border: '#363636' }
    : { bg: '#ffffff', fg: '#262626', sub: '#737373', border: '#dbdbdb' };
  const verb = mode === 'click' ? 'hidden' : 'unhidden';

  const old = document.getElementById('ext-progress');
  if (old) old.remove();
  const card = document.createElement('div');
  card.id = 'ext-progress';
  card.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);' +
    'z-index:2147483647;min-width:260px;padding:14px 20px;border-radius:12px;text-align:center;' +
    `background:${theme.bg};color:${theme.fg};border:1px solid ${theme.border};` +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
    'box-shadow:0 4px 20px rgba(0,0,0,.35);';
  document.body.appendChild(card);

  const render = (title, detail, accent) => {
    card.innerHTML = '';
    const t = document.createElement('div');
    t.style.cssText = `font-size:16px;font-weight:700;${accent ? `color:${accent};` : ''}`;
    t.textContent = title;
    const d = document.createElement('div');
    d.style.cssText = `font-size:13px;margin-top:4px;color:${theme.sub};`;
    d.textContent = detail;
    card.append(t, d);
  };
  const plural = (n) => `${n} account${n === 1 ? '' : 's'}`;
  render('Working…', 'Scrolling and selecting accounts');

  // 1. Find the scrollable ancestor of the first checkbox
  let scrollContainer = document.querySelector(SELECTOR);
  while (scrollContainer && scrollContainer.scrollHeight <= scrollContainer.clientHeight) {
    scrollContainer = scrollContainer.parentElement;
  }

  // Fallback to document if no scrollable div is found
  if (!scrollContainer || scrollContainer === document.body) {
    scrollContainer = document.documentElement;
  }

  // Selected rows use a "circle-check__filled" mask and a colored background;
  // unselected rows use the default gray
  const isChecked = (icon) => {
    const style = window.getComputedStyle(icon);
    const mask = style.maskImage || style.webkitMaskImage || "";
    if (mask.includes("check__filled")) return true;
    if (mask.includes("outline")) return false;
    return style.backgroundColor !== DEFAULT_GRAY;
  };

  console.log(`Starting ${mode} sequence on:`, scrollContainer);

  while (true) {
    const buttons = document.querySelectorAll(SELECTOR);

    for (const button of buttons) {
      if (button.isConnected && !button.hasAttribute('data-ext-processed')) {
        const icon = button.firstElementChild;
        if (icon) {
          const checked = isChecked(icon);

          let clicked = false;
          if (mode === 'click' && !checked) {
            button.click();
            clicked = true;
          } else if (mode === 'unclick' && checked) {
            button.click();
            clicked = true;
          }

          if (clicked) {
            count++;
            render(`Modified ${plural(count)}`, 'Still working — keep this tab open');
            chrome.runtime.sendMessage({ action: "updateCount", count: count }).catch(() => {});
          }
        }
        button.setAttribute('data-ext-processed', 'true');
        await new Promise(r => setTimeout(r, 150));
      }
    }

    // 2. Scroll the specific detected container
    scrollContainer.scrollTop += 600; 
    await new Promise(r => setTimeout(r, 2000));

    let newHeight = scrollContainer.scrollHeight;
    
    // Check if we hit the bottom
    if (newHeight === lastHeight) {
      noChangeCount++;
      if (noChangeCount > 2) break; 
    } else {
      noChangeCount = 0;
      lastHeight = newHeight;
    }
  }
  if (count > 0) {
    render(`Done: modified ${plural(count)}`, `Stories ${verb} from ${count === 1 ? 'this account' : 'these accounts'}`, '#0095f6');
  } else {
    render('Done: no changes needed', `Every account was already ${mode === 'click' ? 'hidden' : 'unhidden'}`, '#0095f6');
  }
  setTimeout(() => card.remove(), 10000);
}
