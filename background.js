const STORAGE_KEYS = {
  provider: "ai_provider",
  apiKeys: "api_keys_by_provider"
};

function languageInstruction(lang) {
  switch (lang) {
    case "fr":
      return "French";

    case "ja":
      return "Japanese";

    default:
      return "English";
  }
}

async function getSettings() {
  const obj = await chrome.storage.local.get([
    STORAGE_KEYS.provider,
    STORAGE_KEYS.apiKeys
  ]);

  const apiKeys = obj?.[STORAGE_KEYS.apiKeys] ?? {};
  const provider = obj?.[STORAGE_KEYS.provider] ?? "openai";

  return {
    provider,
    apiKey: String(apiKeys?.[provider] ?? "").trim()
  };
}

function truncateForModel(text, maxChars) {
  const s = String(text ?? "");
  if (s.length <= maxChars) {return s;}
  return s.slice(0, maxChars);
}

function promptWithLanguage({ language, title, text, url }) {
  const lang = languageInstruction(language);

  const prompt = [
    `Summarize the following web page in ${lang}.`,
    "Return:",
    "- 5 bullet key points",
    "- 1 short paragraph summary",
    "- 3 action items (if applicable)",
    "",
    `Title: ${title}`,
    `URL: ${url}`,
    "",
    "Content:",
    truncateForModel(text, 12000)
  ].join("\n");

  return prompt;
}

async function summarizeWithDeepSeek({ title, url, text, language }) {
  const { apiKey } = await getSettings();
  if (!apiKey) {
    return { ok: false, error: "Missing DeepSeek API key." };
  }

  const resp = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "user", content: promptWithLanguage({ language, title, text, url }) }
      ],
      stream: false,
      max_tokens: 600
    })
  });

  if (!resp.ok) {
    const t = await resp.text();
    return { ok: false, error: t };
  }

  const data = await resp.json();
  const out = data?.choices?.[0]?.message?.content ?? "";

  return { ok: true, summary: String(out || "").trim() };
}

async function summarizeWithOpenAI({ title, url, text, language }, modelVersion) {
  const { apiKey } = await getSettings();
  if (!apiKey) {
    return { ok: false, error: "Missing OpenAI API key." };
  }

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: `gpt-${modelVersion}`,
      input: [
        { role: "user", content: promptWithLanguage({ language, title, text, url }) }
      ],
      max_output_tokens: 600
    })
  });

  if (!resp.ok) {
    const t = await resp.text();
    return { ok:false, error:t };
  }

  const data = await resp.json();

  const out =
    data.output_text ??
    data.output?.map(o =>
      o.content?.map(c => c.text).join("")
    ).join("");

  return { ok:true, summary:String(out || "").trim() };
}

async function summarizeWithAnthropic({ title, url, text, language }) {
  const { apiKey } = await getSettings();
  if (!apiKey) {
    return { ok:false, error:"Missing Anthropic API key." };
  }

  const resp = await fetch(
    "https://api.anthropic.com/v1/messages",
    {
      method:"POST",
      headers:{
        "x-api-key":apiKey,
        "anthropic-version":"2023-06-01",
        "content-type":"application/json",
        "anthropic-dangerous-direct-browser-access":"true"
      },
      body:JSON.stringify({
        model:"claude-3-5-sonnet-latest",
        max_tokens:600,
        messages:[
          { role: "user", content: promptWithLanguage({ language, title, text, url }) }
        ]
      })
    }
  );

  if (!resp.ok) {
    const t = await resp.text();
    return { ok:false, error:t };
  }

  const data = await resp.json();

  const out =
    data.content
      ?.map(c => c.text)
      .join("");

  return { ok:true, summary:String(out || "").trim() };
}

chrome.runtime.onMessage.addListener((msg,_,sendResponse)=>{
  if(msg?.type==="SUMMARIZE_PAGE"){
    (async()=>{
      const { provider } = await getSettings();

      switch (provider) {
        case "anthropic":
          return summarizeWithAnthropic(msg.payload);

        case "deepseek":
          return summarizeWithDeepSeek(msg.payload);

        case "openai":
        default:
          return summarizeWithOpenAI(msg.payload, "5.4");
      }
    })()
      .then(sendResponse)
      .catch(e=>sendResponse({ ok:false,error:String(e) }));

    return true;
  }
});
