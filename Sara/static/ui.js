/* Progressive enhancement only; all business state and permissions live in Django. */
(() => {
'use strict';
const all=(q,root=document)=>[...root.querySelectorAll(q)];
let language=window.SharaLanguage?.language || 'bn';
const names={food:['খাদ্য','Food'],water:['বিশুদ্ধ পানি','Water'],medicine:['ওষুধ','Medicine'],rescue:['উদ্ধার','Rescue'],shelter:['আশ্রয়','Shelter']};
function translate(){
 if(window.SharaLanguage){window.SharaLanguage.translate();return;}
 document.documentElement.lang=language;
 all('[data-en]').forEach(el=>{if(!el.dataset.bn)el.dataset.bn=el.textContent;el.textContent=el.dataset[language];});
 all('[data-need]').forEach(el=>el.textContent=(names[el.dataset.need]||[el.dataset.need,el.dataset.need])[language==='en'?1:0]);
 all('button[lang]').forEach(el=>el.setAttribute('aria-pressed',String(el.lang===language)));
}
document.addEventListener('click',async event=>{
 const button=event.target.closest('button'); if(!button)return;
 if(['bn','en'].includes(button.lang)){language=button.lang;risk();}
 if(button.hasAttribute('data-menu')){const menu=document.querySelector('.ui-public-menu');const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));menu?.classList.toggle('is-open',open);}
 if(button.dataset.copy){
  let message;
  try{await navigator.clipboard.writeText(button.dataset.copy);message=language==='en'?'Copied':'কপি হয়েছে';}
  catch{message=language==='en'?'Select and copy the text':'লেখা নির্বাচন করে কপি করুন';}
  const feedback=button.querySelector('[data-copy-feedback]');
  if(feedback){feedback.textContent=message;button.title=message;}else{button.textContent=message;}
 }
});
document.addEventListener('submit',event=>{
 const form=event.target, button=event.submitter;
 if(button?.hasAttribute('data-confirm')&&!window.confirm(language==='en'?'Confirm this action?':'এই কাজটি নিশ্চিত করবেন?')){event.preventDefault();return;}
 if(form.dataset.submitting==='true'){event.preventDefault();return;}
 form.dataset.submitting='true';form.setAttribute('aria-busy','true');
 // Preserve the clicked button's action in the submitted payload.
 if(button?.name){const hidden=document.createElement('input');hidden.type='hidden';hidden.name=button.name;hidden.value=button.value;form.append(hidden);}
 all('button[type=submit]',form).forEach(el=>el.disabled=true);
});
window.addEventListener('pageshow',()=>all('form').forEach(form=>{delete form.dataset.submitting;form.removeAttribute('aria-busy');all('button[type=submit]',form).forEach(el=>el.disabled=false);}));
const catalogue=JSON.parse(document.querySelector('#shara-geography')?.textContent||'{}');
all('select[name$="district_code"]').forEach(district=>{
 const upazila=district.form.querySelector('select[name="'+district.name.replace('district_code','upazila_code')+'"]');
 if(!upazila)return;
 const union=district.form.querySelector('select[name="'+district.name.replace('district_code','union_code')+'"]');
 const manualUnion=district.form.querySelector('input[name="'+district.name.replace('district_code','union')+'"]');
 let pending;
 function clearUnion(){
  pending?.abort();
  if(union){union.replaceChildren(new Option(language==='en'?'Select union (optional)':'ইউনিয়ন বাছুন (ঐচ্ছিক)',''));union.removeAttribute('aria-busy');}
  if(manualUnion)manualUnion.value='';
 }
 district.addEventListener('change',()=>{upazila.replaceChildren(new Option(language==='en'?'Select upazila':'উপজেলা বাছুন',''));Object.entries(catalogue[district.value]?.upazilas||{}).forEach(([code,label])=>upazila.add(new Option(label,code)));clearUnion();});
 upazila.addEventListener('change',async()=>{
  clearUnion();if(!union||!upazila.value)return;
  const endpoint=document.querySelector('[data-unions-url]')?.dataset.unionsUrl;
  if(!endpoint)return;
  pending=new AbortController();
  const selected=upazila.value,controller=pending;
  union.setAttribute('aria-busy','true');
  try{
   const url=new URL(endpoint,location.origin);url.searchParams.set('district',district.value);url.searchParams.set('upazila',selected);
   const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error('Geography lookup failed');
   const data=await response.json();if(upazila.value!==selected||pending!==controller)return;
   data.results.forEach(item=>{const pair=item.name.split(' / ');if(pair.length===2)window.SharaLanguage?.register(...pair);union.add(new Option(item.name,item.code));});
  }catch(error){if(error.name!=='AbortError'&&pending===controller)union.options[0].text=language==='en'?'Could not load; enter union below (optional)':'লোড হয়নি; নিচে নাম লিখতে পারেন (ঐচ্ছিক)';}
  finally{if(pending===controller)union.removeAttribute('aria-busy');}
 });
});
const digitMap='০১২৩৪৫৬৭৮৯';
all('input[type=tel],input[name$="phone"],input[name="person_count"]').forEach(input=>input.addEventListener('input',()=>{input.value=input.value.replace(/[০-৯]/g,x=>digitMap.indexOf(x));}));
function risk(){
 const output=document.querySelector('#risk-preview');if(!output)return;
 const checked=name=>document.querySelector('input[name="'+name+'"]')?.checked;
 const critical=['immediate_rescue_required','trapped_person','critical_medical_emergency'].some(checked);
 const high=['injured_person','child_in_danger','elderly_in_danger'].some(checked);
 output.textContent=(language==='en'?'Suggested priority: ':'প্রস্তাবিত অগ্রাধিকার: ')+(critical?(language==='en'?'Critical':'জরুরি'):high?(language==='en'?'High':'উচ্চ'):(language==='en'?'Normal':'সাধারণ'));
}
all('input[type=checkbox]').forEach(input=>input.addEventListener('change',risk));
const params=new URLSearchParams(location.search);
all('form[method=get] select').forEach(select=>{if(params.has(select.name))select.value=params.get(select.name);});
all('.ui-sidebar-menu a').forEach(a=>{if(new URL(a.href).pathname===location.pathname)a.setAttribute('aria-current','page');});
const portalMenu=document.querySelector('.ui-sidebar-menu');
if(portalMenu&&!portalMenu.querySelector('[aria-current=page]')){
 const parent=all('a',portalMenu).filter(a=>location.pathname.startsWith(new URL(a.href).pathname)).sort((a,b)=>new URL(b.href).pathname.length-new URL(a.href).pathname.length)[0];
 parent?.setAttribute('aria-current','page');
}
// Keep basic profile information before the long coverage checklist.
all('[data-field="districts"]').forEach(field=>{
 const grid=field.parentElement;if(grid?.classList.contains('ui-field-grid'))grid.append(field);
 const choices=field.querySelector('div[id]');
 if(choices){choices.tabIndex=0;choices.setAttribute('role','group');choices.setAttribute('aria-label',field.querySelector('label')?.textContent||'Service districts');}
});
// Group existing records and contacts for scanning without changing their actions.
all('.ui-record-state').forEach(state=>state.closest('article')?.classList.add('ui-record'));
const directory=document.querySelector('.ui-page-resources');
function prepareContacts(root){
 const contacts=all('[data-contact-list] > article.ui-card',root);
 contacts.forEach(contact=>{
  contact.classList.add('ui-contact');
  // Keep useful area/source/alternate-contact information, omit import bookkeeping.
  const notes=contact.querySelector('small')?.previousElementSibling;
  if(directory?.contains(contact)&&notes?.tagName==='P'&&notes.textContent.includes('CSV officer_id:')){
   const lines=notes.innerText.split('\n').filter(line=>! /^(CSV officer_id:|Designation code:|Retrieved:|Level:|Office:|Unverified phone as supplied)/.test(line.trim()));
   notes.textContent=lines.join('\n');notes.classList.add('ui-contact-notes');
  }
 });
}
prepareContacts(document);
document.addEventListener('click',async event=>{
 const link=event.target.closest('[data-contact-more]');if(!link)return;
 if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
 event.preventDefault();if(link.getAttribute('aria-disabled')==='true')return;
 const results=link.closest('[data-contact-results]'),list=results.querySelector('[data-contact-list]');
 const error=results.querySelector('[data-contact-load-error]');
 error.hidden=true;link.setAttribute('aria-disabled','true');results.setAttribute('aria-busy','true');
 const label=link.textContent;link.textContent=language==='en'?'Loading contacts…':'যোগাযোগ লোড হচ্ছে…';
 try{
  const url=new URL(link.href);url.searchParams.set('fragment','contacts');
  const response=await fetch(url,{credentials:'same-origin'});if(!response.ok)throw new Error('Could not load contacts');
  const doc=new DOMParser().parseFromString(await response.text(),'text/html');
  const incoming=doc.querySelector('[data-contact-results]');if(!incoming)throw new Error('Unexpected response');
  const cards=all('[data-contact-list] > article',incoming);
  cards.forEach(card=>list.append(document.importNode(card,true)));
  const shown=Number(results.querySelector('[data-contact-count]').textContent);
  const status=results.querySelector('[data-contact-pagination] p[role=status]');
  status.replaceChildren(...[...incoming.querySelector('p[role=status]').childNodes].map(node=>document.importNode(node,true)));
  results.querySelector('[data-contact-count]').textContent=shown+cards.length;
  const next=incoming.querySelector('[data-contact-more]');
  if(next)link.replaceWith(document.importNode(next,true));else link.remove();
  prepareContacts(results);
  const heading=list.children[list.children.length-cards.length]?.querySelector('h2');
  if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
 }catch{
  error.hidden=false;link.textContent=label;link.removeAttribute('aria-disabled');
 }finally{results.removeAttribute('aria-busy');}
});
const homeHero=document.querySelector('.ui-page-home .ui-hero-copy h2');
if(homeHero){const heading=document.createElement('h1');[...homeHero.attributes].forEach(attr=>heading.setAttribute(attr.name,attr.value));heading.replaceChildren(...homeHero.childNodes);homeHero.replaceWith(heading);}
// Organize the same application controls into small, named task groups.
const requestFields=document.querySelector('.ui-request-form [data-field="need_categories"]')?.parentElement;
if(requestFields){
 const sections=[
  {bn:'কী সহায়তা প্রয়োজন?',en:'Assistance needed',fields:['is_proxy','need_categories','person_count']},
  {bn:'যোগাযোগের তথ্য',en:'Contact details',fields:['contact_phone','victim_name','reporter_name','reporter_phone','reporter_relationship']},
  {bn:'জরুরি পরিস্থিতি ও ঝুঁকি',en:'Emergency & risks',fields:['immediate_rescue_required','trapped_person','critical_medical_emergency','injured_person','child_in_danger','elderly_in_danger','emergency_condition']}
 ];
 sections.forEach(section=>{
  const fields=section.fields.map(name=>requestFields.querySelector(':scope > [data-field="'+name+'"]')).filter(Boolean);
  if(!fields.length)return;
  const group=document.createElement('section');group.className='ui-form-subsection ui-field-wide';
  const heading=document.createElement('h3');heading.dataset.en=section.en;heading.dataset.bn=section.bn;heading.textContent=section.bn;group.append(heading);
  const grid=document.createElement('div');grid.className='ui-field-grid';fields.forEach(field=>grid.append(field));group.append(grid);requestFields.append(group);
 });
}
translate();risk();
document.addEventListener('shara:languagechange',event=>{language=event.detail.language;risk();});
const error=document.querySelector('.ui-form-error');if(error){error.focus();error.scrollIntoView({block:'center'});}
})();

