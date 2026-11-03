/* Exact UI translations. Values, URLs, identifiers and submitted text are never rewritten. */
(() => {
 'use strict';
 const entries = new Map();
 const textSources = new WeakMap();
 const attributeSources = new WeakMap();
 const excluded = 'script,style,textarea,code,pre,[data-i18n-skip]';
 let language = /(?:^|;\s*)django_language=en(?:;|$)/.test(document.cookie || '') ? 'en' : 'bn';
 try { const saved = localStorage.getItem('shara_language'); if (['bn','en'].includes(saved)) language = saved; } catch { /* Fall back to the locale cookie. */ }
 function register(bn, en) {
  const pair = {bn: bn.trim().replace(/:$/, ''), en: en.trim().replace(/:$/, '')};
  if (!pair.bn || !pair.en) return;
  [pair.bn, pair.en, `${pair.bn} / ${pair.en}`].forEach(key => { if (!entries.has(key)) entries.set(key, pair); });
 }
 const extra = [
  ['ভাষা','Language'],['ভাষা নির্বাচন করুন','Choose language'],['SHARA হোম','SHARA home'],['প্রধান মেনু','Main menu'],['পোর্টাল','Portal'],
  ['আবেদনের ইতিহাস','Request history'],['SHARA-এর কার্যক্রম','SHARA activity'],['প্রয়োজনীয়','required'],
  ['বন্ধ করুন','Close'],
  ['প্রয়োজনীয়','Required'],['ফোন নম্বর কপি করুন','Copy phone number'],['ইমেইল ঠিকানা কপি করুন','Copy email address'],
  ['জেলা বাছুন','Select district'],['উপজেলা বাছুন','Select upazila'],['ইউনিয়ন বাছুন (ঐচ্ছিক)','Select union (optional)'],
  ['লোড হয়নি; নিচে নাম লিখতে পারেন (ঐচ্ছিক)','Could not load; enter union below (optional)'],
  ['সেবার জেলা','Service districts'],['কপি হয়েছে','Copied'],['লেখা নির্বাচন করে কপি করুন','Select and copy the text'],
  ['কোনো ফলাফল নেই','No results'],['(ঐচ্ছিক)','(optional)'],
  ['শুধু অপেক্ষমাণ সংগঠনের আবেদন পর্যালোচনা করা যায়।','Only a pending organization can be reviewed.'],
  ['শুধু প্রত্যাখ্যাত সংগঠন আবার আবেদন করতে পারে।','Only a rejected organization can be resubmitted.'],
  ['শুধু অপেক্ষমাণ আবেদন পর্যালোচনা করা যায়।','Only a pending application can be reviewed.'],
  ['প্রত্যাখ্যানের কারণ লিখুন।','A rejection reason is required.'],
  ['সদস্যতার এই কাজটি আর উপলব্ধ নেই।','This membership action is no longer available.'],
  ['সদস্য ইতোমধ্যে দল ছেড়েছেন।','The member has already left this team.'],
  ['নির্বাচিত সদস্য আর বিদ্যমান নেই।','A selected member no longer exists.'],
  ['শুধু দায়িত্ব নির্ধারিত হয়নি এমন অপেক্ষমাণ আবেদনের ব্যাখ্যা চাওয়া যায়।','Only an unassigned pending request can be clarified.'],
  ['অপেক্ষমাণ আবেদনের ব্যাখ্যার উত্তর লিখুন।','A clarification response is required for a waiting request.'],
  ['আবেদন প্রত্যাখ্যানের আগে সক্রিয় মিশন শেষ করুন।','End any active mission before rejecting this request.'],
  ['বন্ধ আবেদন পরিবর্তন করা যায় না।','A closed request is read-only.'],
  ['বাতিল বা ব্যর্থতার কারণ লিখুন।','A cancellation/failure reason is required.'],
  ['সংগঠনের প্রশাসক প্রয়োজন।','An organization administrator is required.'],
  ['অফিসের ঠিকানা প্রয়োজন।','An office address is required.'],
  ['স্বেচ্ছাসেবকের অ্যাকাউন্ট প্রয়োজন।','A volunteer account is required.'],
  ['বর্তমান ঠিকানা প্রয়োজন।','A current address is required.'],
  ['স্থানীয় দিকনির্দেশনাসহ ঠিকানা প্রয়োজন।','An address with local directions is required.'],
  ['অগ্রাধিকার পরিবর্তনের কারণ লিখুন।','A priority override requires a reason.'],
  ['নেতাকে এই দলের সক্রিয় সদস্য হতে হবে।','The leader must be an active member of this team.'],
  ['সক্রিয় সদস্যকে সংশ্লিষ্ট সংগঠনের অনুমোদিত সদস্য হতে হবে।','An active member must be approved in the owning organization.'],
 ];
 extra.forEach(pair => register(...pair));
 function value(text) {
  const trimmed = text.trim();
  if (trimmed.endsWith(':') && entries.has(trimmed.slice(0,-1))) {
   return text.replace(trimmed, entries.get(trimmed.slice(0,-1))[language] + ':');
  }
  const match = entries.get(trimmed);
  if (match) return text.replace(trimmed, match[language]);
  if (trimmed.endsWith(':')) return value(text.slice(0,text.lastIndexOf(':'))) + text.slice(text.lastIndexOf(':'));
  const count = text.match(/^(\s*[0-9০-৯]+\s+)(.+)$/);
  if (count && entries.has(count[2].trim())) return count[1] + value(count[2]);
  if (trimmed.endsWith(' (optional)') && entries.has(trimmed.slice(0,-11))) {
   return text.replace(trimmed, entries.get(trimmed.slice(0,-11))[language] + (language === 'bn' ? ' (ঐচ্ছিক)' : ' (optional)'));
  }
  return text.split(/( · | — |, |\n|: )/).map(part => {
   const item = entries.get(part.trim());
   return item ? part.replace(part.trim(), item[language]) : part;
  }).join('');
 }
 function translate(root = document) {
  const marked = [...root.querySelectorAll('[data-en]')];
  marked.forEach(el => {
   if (!el.dataset.bn) el.dataset.bn = el.textContent;
   register(el.dataset.bn, el.dataset.en);
   const next = el.dataset[language];
   if (el.textContent !== next) el.textContent = next;
  });
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
   if (!node.parentElement || node.parentElement.closest(excluded + ',[data-en],button[lang]')) return;
   const remembered = textSources.get(node);
   const source = remembered && remembered.output === node.data ? remembered.source : node.data;
   if (node.parentElement.tagName === 'OPTION') {
    const parts = source.trim().split(' / ');
    if (parts.length === 2 && /[\u0980-\u09ff]/.test(parts[0])) register(...parts);
   }
   const output = value(source);
   textSources.set(node, {source, output});
   if (node.data !== output) node.data = output;
  });
  root.querySelectorAll('[aria-label],[title],[placeholder],[alt]').forEach(el => {
   if (el.closest(excluded)) return;
   const sources = attributeSources.get(el) || {};
   ['aria-label','title','placeholder','alt'].forEach(attr => {
    if (!el.hasAttribute(attr)) return;
    const current = el.getAttribute(attr), remembered = sources[attr];
    const source = remembered && remembered.output === current ? remembered.source : current;
    const output = value(source);
    sources[attr] = {source, output};
    if (current !== output) el.setAttribute(attr, output);
   });
   attributeSources.set(el, sources);
  });
  document.documentElement.lang = language;
  root.querySelectorAll('time[datetime]').forEach(el => {
   const date = new Date(el.getAttribute('datetime'));
   if (!Number.isNaN(date.getTime())) {
    const output = new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-GB', {dateStyle:'medium', timeStyle:'short'}).format(date);
    if (el.textContent !== output) el.textContent = output;
   }
  });
  document.querySelectorAll('button[lang]').forEach(el => el.setAttribute('aria-pressed', String(el.lang === language)));
 }
 function save() {
  try { localStorage.setItem('shara_language', language); } catch { /* Switching still works for this page. */ }
  try { document.cookie = `django_language=${language};path=/;max-age=31536000;SameSite=Lax`; } catch { /* The active page still switches if cookies are disabled. */ }
 }
 function setLanguage(next) {
  if (!['bn','en'].includes(next)) return;
  language = next; save(); translate();
  document.dispatchEvent(new CustomEvent('shara:languagechange', {detail: {language}}));
 }
 function geography(value) {
  if (typeof value === 'string') {
   const parts = value.split(' / ');
   if (parts.length === 2) register(parts[0], parts[1]);
  } else if (value && typeof value === 'object') Object.values(value).forEach(geography);
 }
 const script = document.querySelector('script[data-translations]');
 const ready = (async () => {
  try {
   const response = await fetch(script.dataset.translations, {credentials: 'same-origin'});
   if (!response.ok) throw new Error('Translation catalogue unavailable');
   (await response.json()).forEach(pair => register(...pair));
  } catch (error) { console.error(error); }
  const geo = document.getElementById('shara-geography');
  if (geo) geography(JSON.parse(geo.textContent));
  save(); translate();
  // Observe async contact batches, geography choices and validation feedback.
  let scheduled = false;
  const observer = new MutationObserver(() => {
   if (scheduled) return;
   scheduled = true;
   queueMicrotask(() => { scheduled = false; observer.disconnect(); translate(); observe(); });
  });
  function observe() { observer.observe(document.body, {subtree: true, childList: true, characterData: true}); }
  observe();
 })();
 document.addEventListener('click', event => {
  const button = event.target.closest('button[lang]');
  if (button) setLanguage(button.lang);
 });
 window.addEventListener('storage', event => { if (event.key === 'shara_language') setLanguage(event.newValue); });
 window.SharaLanguage = {get language() {return language;}, setLanguage, translate, register, value, ready};
})();
