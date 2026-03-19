import { SETTINGS_STORAGE_KEYS } from './constants.js';
import { extractPageText } from './extraction.js';
import { getTimezoneLabel } from './timezone.js';
import { getSettings } from './settings.js';
import { getActiveTab } from './tab.js';

const SUMMARY_CACHE_TTL_MS = 48 * 60 * 60 * 1000;

function makeSummaryCacheKey({ provider, language, url }) {
  const safeUrl = String(url || "").split("#")[0];
  return `summary:${provider}:${language}:${safeUrl}`;
}

async function getCachedSummary({ provider, language, url }) {
  const key = makeSummaryCacheKey({ provider, language, url });
  const data = await chrome.storage.local.get(key);
  const entry = data[key];

  if (!entry) { return null; }

  const { summary, createdAt } = entry;

  if (!summary || !createdAt) { return null; }

  const age = Date.now() - createdAt;

  if (age > SUMMARY_CACHE_TTL_MS) { return null; }

  return summary;
}

async function setCachedSummary({ provider, language, url, summary }) {
  const key = makeSummaryCacheKey({ provider, language, url });

  await chrome.storage.local.set({
    [key]: {
      summary,
      createdAt: Date.now()
    }
  });
}

async function setProvider(provider) {
  await chrome.storage.local.set({[SETTINGS_STORAGE_KEYS.provider]:provider});
}

async function setLanguage(language) {
  await chrome.storage.local.set({[SETTINGS_STORAGE_KEYS.language]:language});
}

function setStatus(msg){
  const statusEl = document.getElementById("statusText");

  statusEl.style.display="block";
  statusEl.textContent=msg;

  document
    .getElementById("summaryText")
    .style.display="none";
}

function setSummary(text){
  const pre = document.getElementById("summaryText");

  pre.textContent=text;
  pre.style.display="block";

  document
    .getElementById("statusText")
    .style.display="none";

  document
    .getElementById("copyBtn")
    .disabled=!text.trim();
}

async function summarizeActiveTab(){
  const {provider,apiKey,language} =
  await getSettings();

  if(!apiKey){
    setStatus("Missing API key. Click Settings.");
    return;
  }

  const tab = await getActiveTab();

  if(!tab?.url?.startsWith("http")){
    setStatus("Open a normal web page.");
    return;
  }

  setStatus("Reading page…");

  const page = await extractPageText(tab.id);
  const url = page.url || tab.url;

  const cached = await getCachedSummary({
    provider,
    language,
    url
  });

  if (cached) {
    setSummary(cached);
    return;
  }

  setStatus("Summarizing…");

  const resp = await chrome.runtime.sendMessage({
    type:"SUMMARIZE_PAGE",
    payload:{
      ...page,
      language
    }
  });

  if(!resp?.ok){
    setStatus(resp?.error || "Failed to summarize.");
    return;
  }

  await setCachedSummary({
    provider,
    language,
    url,
    summary: resp.summary
  });

  setSummary(resp.summary);
}

async function refresh() {
  document.getElementById("timezone").textContent =
  getTimezoneLabel();

  const tab = await getActiveTab();

  document.getElementById("currentPage").textContent =
  tab?.title || "—";

  document.getElementById("summarizeBtn").disabled =
  !tab?.url?.startsWith("http");

  const {provider,language} = await getSettings();

  document.getElementById("providerSelect").value=provider;
  document.getElementById("languageSelect").value=language;
}

document
  .getElementById("summarizeBtn")
  .addEventListener("click",summarizeActiveTab);

document
  .getElementById("providerSelect")
  .addEventListener("change",async e=>{
    await setProvider(e.target.value);
  });

document
  .getElementById("languageSelect")
  .addEventListener("change",async e=>{
    await setLanguage(e.target.value);
  });

document
  .getElementById("copyBtn")
  .addEventListener("click",async ()=>{
    const text = document.getElementById("summaryText").textContent;
    await navigator.clipboard.writeText(text);
  });

document
  .getElementById("backButton")
  .addEventListener("click",async()=>{
    document.getElementById("settingsSection").style.display="none";
    document.getElementById("mainView").style.display="block";
    await refresh();
  });

document
  .getElementById("settingsProvider")
  .addEventListener("change",async e=>{
    const provider=e.target.value;

    await chrome.storage.local.set({
      [SETTINGS_STORAGE_KEYS.provider]:provider
    });

    const data = await chrome.storage.local.get(
      SETTINGS_STORAGE_KEYS.apiKeys
    );

    const keys=data[SETTINGS_STORAGE_KEYS.apiKeys]||{};

    document.getElementById("apiKeyInput").value= keys[provider]||"";
  });

refresh();
