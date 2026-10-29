/* SHARA home: native DOM and browser-local interactions. No frontend runtime dependencies. */
"use strict";
(() => {
  // dom.js
  var current = null;
  var rootPaint = null;
  var queued = false;
  var sections =  new Map();
  var effects = [];
  var visited =  new Set();
  var propsFor =  new WeakMap();
  var svgTags = new Set("svg path rect circle ellipse line polyline polygon g defs clipPath text use symbol".split(" "));
  var unitless =  new Set(["opacity", "zIndex", "fontWeight", "flex", "flexGrow", "flexShrink", "order", "lineHeight", "strokeWidth"]);
  function refresh() {
    if (queued || !rootPaint) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      rootPaint();
    });
  }
  function slot(initial) {
    if (!current) throw new Error("Page state requires a page section.");
    const index = current.index++;
    if (!(index in current.values)) current.values[index] = initial();
    return current.values[index];
  }
  function stateValue(initial) {
    const box = slot(() => {
      const box2 = { value: typeof initial === "function" ? initial() : initial };
      box2.update = (next) => {
        const value = typeof next === "function" ? next(box2.value) : next;
        if (!Object.is(value, box2.value)) {
          box2.value = value;
          refresh();
        }
      };
      return box2;
    });
    return [box.value, box.update];
  }
  var retain = (initial) => slot(() => ({ current: initial }));
  var uniqueId = () => slot(() => `shara-${current.path.replace(/[^a-zA-Z0-9_-]/g, "-")}-${current.index}`);
  var calculate = (callback) => callback();
  function afterPaint(callback, dependencies) {
    const box = slot(() => ({ dependencies: void 0, cleanup: void 0 }));
    const changed = !dependencies || !box.dependencies || dependencies.some((value, i) => !Object.is(value, box.dependencies[i]));
    if (changed) {
      box.dependencies = dependencies;
      effects.push(() => {
        box.cleanup?.();
        box.cleanup = callback();
      });
    }
  }
  function subscribeState(subscribe, snapshot) {
    const box = slot(() => ({ cleanup: subscribe(refresh) }));
    return snapshot();
  }
  var fragment =  Symbol("document-fragment");
  var overlay = (child) => child;
  function childrenInto(parent, children) {
    for (const child of children.flat(Infinity)) {
      if (child == null || typeof child === "boolean") continue;
      parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
  }
  function apply(node2, props, previous = {}) {
    if (previous.ref && previous.ref !== props.ref) previous.ref.current = null;
    for (const [name, value] of Object.entries(previous)) {
      if (name.startsWith("on") && typeof value === "function") node2.removeEventListener(eventName(name, node2), value);
    }
    for (const attribute of [...node2.attributes]) {
      if (node2.tagName === "DIALOG" && attribute.name === "open") continue;
      if (attribute.name !== "data-shara-node" && attribute.name !== "data-shara-key") node2.removeAttribute(attribute.name);
    }
    for (let [name, value] of Object.entries(props)) {
      if (["key", "children", "__site"].includes(name)) continue;
      if (name === "ref") {
        if (value) value.current = node2;
        continue;
      }
      if (name.startsWith("on") && typeof value === "function") {
        node2.addEventListener(eventName(name, node2), value);
        continue;
      }
      if (name === "style") {
        for (const [property, setting] of Object.entries(value || {})) {
          node2.style[property] = typeof setting === "number" && setting !== 0 && !unitless.has(property) ? `${setting}px` : setting;
        }
        continue;
      }
      if (name === "value" || name === "checked" || name === "selected") continue;
      if (value == null || value === false && !name.startsWith("aria-") && !name.startsWith("data-")) continue;
      name = { className: "class", htmlFor: "for", tabIndex: "tabindex", autoFocus: "autofocus", inputMode: "inputmode", noValidate: "novalidate", readOnly: "readonly", strokeWidth: "stroke-width", strokeLinecap: "stroke-linecap", strokeLinejoin: "stroke-linejoin", textAnchor: "text-anchor", fontSize: "font-size", fontWeight: "font-weight", paintOrder: "paint-order", clipPath: "clip-path", pointerEvents: "pointer-events" }[name] || name;
      node2.setAttribute(name, value === true && !name.startsWith("aria-") && !name.startsWith("data-") ? "" : String(value));
    }
    if ("value" in props && node2.type !== "file") {
      const value = props.value ?? "";
      if (node2.value !== String(value)) node2.value = value;
      if (node2.tagName === "INPUT") node2.setAttribute("value", value);
      if (node2.tagName === "TEXTAREA" && !node2.isConnected) node2.textContent = value;
    }
    if ("checked" in props) {
      node2.checked = !!props.checked;
      node2.toggleAttribute("checked", !!props.checked);
    }
    if ("selected" in props) node2.selected = !!props.selected;
    propsFor.set(node2, props);
  }
  function eventName(name, node2) {
    if (name === "onChange") return ["SELECT"].includes(node2.tagName) || ["checkbox", "radio", "file"].includes(node2.type) ? "change" : "input";
    return name.slice(2).toLowerCase();
  }
  function node(tag, props, ...children) {
    props ||= {};
    if (tag === fragment) return children.flat(Infinity);
    if (typeof tag === "function") {
      const parent = current;
      const path = `${parent?.path || "page"}/${props.__site || tag.name}:${props.key ?? ""}`;
      let section = sections.get(path);
      if (!section) {
        section = { path, values: [], index: 0 };
        sections.set(path, section);
      }
      section.index = 0;
      visited.add(path);
      current = section;
      try {
        return tag({ ...props, children: children.length ? children.flat(Infinity) : props.children });
      } finally {
        current = parent;
      }
    }
    const element = svgTags.has(tag) ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
    if (props.__site) element.setAttribute("data-shara-node", props.__site);
    if (props.key != null) element.setAttribute("data-shara-key", String(props.key));
    childrenInto(element, children.length ? children : [props.children]);
    apply(element, props);
    return element;
  }
  function same(old, next) {
    return old.nodeType === next.nodeType && old.nodeName === next.nodeName && (old.nodeType !== 1 || old.getAttribute("data-shara-node") === next.getAttribute("data-shara-node") && old.getAttribute("data-shara-key") === next.getAttribute("data-shara-key"));
  }
  function sync(parent, nextChildren) {
    for (let i = 0; i < nextChildren.length; i++) {
      const next = nextChildren[i];
      let old = parent.childNodes[i];
      if (!old || !same(old, next)) {
        old = [...parent.childNodes].slice(i + 1).find((candidate) => same(candidate, next));
        if (old) parent.insertBefore(old, parent.childNodes[i]);
        else {
          parent.insertBefore(next, parent.childNodes[i] || null);
          connectRefs(next);
          if (next.nodeType === 1) {
            const focus = next.matches("[autofocus]") ? next : next.querySelector("[autofocus]");
            focus?.focus();
          }
          continue;
        }
      }
      if (next.nodeType === 3) {
        if (old.textContent !== next.textContent) old.textContent = next.textContent;
        continue;
      }
      if (next.nodeType !== 1) continue;
      const wasOpen = old.tagName === "DIALOG" && old.open;
      sync(old, [...next.childNodes]);
      apply(old, propsFor.get(next) || {}, propsFor.get(old) || {});
      if (wasOpen) old.setAttribute("open", "");
    }
    while (parent.childNodes.length > nextChildren.length) parent.lastChild.remove();
  }
  function connectRefs(element) {
    if (element.nodeType !== 1) return;
    const props = propsFor.get(element);
    if (props?.ref) props.ref.current = element;
    for (const child of element.children) connectRefs(child);
  }
  function mountPage(render) {
    const host = document.getElementById("shara-app");
    rootPaint = () => {
      effects = [];
      visited =  new Set();
      const content = document.createDocumentFragment();
      childrenInto(content, [render()]);
      sync(host, [...content.childNodes]);
      for (const [path, section] of sections) {
        if (!visited.has(path)) {
          for (const value of section.values) value?.cleanup?.();
          sections.delete(path);
        }
      }
      const pending = effects;
      effects = [];
      for (const effect of pending) effect();
    };
    rootPaint();
  }

  // navigation.js
  var configuration = JSON.parse(document.getElementById("shara-routes").textContent);
  var pageContent;
  var setPageContent = (callback) => {
    pageContent = callback;
  };
  var Outlet = () => pageContent();
  var readLocation = () => ({ pathname: window.location.pathname.replace(/\/+$/, "") || "/", search: window.location.search });
  function routeHref(destination) {
    const url = new URL(destination, window.location.origin);
    if (url.origin !== window.location.origin) return url.href;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    for (const route of configuration.pages) {
      const pattern = "^" + route.path.replace(/:[a-z]+/g, "([^/]+)") + "$";
      const match = path.match(new RegExp(pattern));
      if (!match) continue;
      let href = route.url;
      if (match[1]) href = href.replace("__id__", encodeURIComponent(decodeURIComponent(match[1])));
      return href + url.search + url.hash;
    }
    throw new Error(`Missing Django destination: ${destination}`);
  }
  var navigation = () => (to, options = {}) => {
    const href = routeHref(to);
    if (options.replace) window.location.replace(href);
    else window.location.assign(href);
  };
  function Link({ to, children, className, ...props }) {
    delete props.end;
    delete props.__site;
    return node("a", { ...props, className, href: routeHref(to) }, children);
  }
  function NavLink({ to, className, end, ...props }) {
    const current2 = readLocation().pathname;
    const isActive = end ? current2 === to : current2 === to || current2.startsWith(to + "/");
    return Link({ to, ...props, "aria-current": isActive ? "page" : void 0, className: typeof className === "function" ? className({ isActive }) : className });
  }
  window.addEventListener("popstate", refresh);

  // en.json
  var en_default = {
    "পর্যালোচনার অপেক্ষায়": "Awaiting review",
    "যাচাইকৃত · দল বাকি": "Verified · awaiting a team",
    "নেতার স্বীকৃতি বাকি": "Awaiting leader acknowledgement",
    "কার্যক্রমে সমস্যা": "Mission needs attention",
    "সংগঠন যাচাই বাকি": "Organizations awaiting verification",
    "সুপার অ্যাডমিন সারসংক্ষেপ": "Super admin overview",
    "পর্যালোচনা, যাচাই ও দলভিত্তিক সাড়ার পরবর্তী কাজ": "Next steps for review, verification and team-based response",
    "তালিকা দেখুন": "View list",
    "যাচাইকৃত আবেদন → উপযুক্ত দল → দলনেতার স্বীকৃতি → অগ্রগতি → সম্পন্ন। কোনো ব্যক্তিকে আলাদাভাবে dispatch করা হয় না।": "Verified request → eligible team → leader acknowledgement → progress → completion. Missions are never assigned to individuals.",
    "সহায়তার আবেদন পর্যালোচনা": "Review help requests",
    "ফিল্টার URL-এ থাকে; বিস্তারিত থেকে ফিরলেও নির্বাচন অক্ষুণ্ণ থাকবে": "Filters stay in the URL and are preserved when you return from a request",
    "রেফারেন্স বা উপজেলা": "Reference or upazila",
    জেলা: "District",
    "সব জেলা": "All districts",
    যাচাই: "Verification",
    "সব অবস্থা": "All statuses",
    "পর্যালোচনা বাকি": "Awaiting review",
    যাচাইকৃত: "Verified",
    প্রত্যাখ্যাত: "Rejected",
    "সব ফিল্টার মুছুন": "Clear all filters",
    "টি আবেদন": " requests",
    জন: " people",
    "পর্যালোচনা ও দল নির্ধারণ": "Review and assign a team",
    "কোনো আবেদন মেলেনি": "No matching requests",
    "ফিল্টার মুছুন": "Clear filters",
    "ফিল্টার বদলে আবার দেখুন।": "Change the filters and try again.",
    "আবেদন পাওয়া যায়নি": "Request not found",
    "আবেদনের তালিকা": "Help requests",
    "আবেদনের তালিকায় ফিরুন": "Back to requests",
    "অন্যের পক্ষে": "On someone else's behalf",
    "সরাসরি আবেদন": "Direct request",
    "আবেদনের তথ্য": "Request details",
    "সহায়তা:": "Assistance:",
    "অতিরিক্ত বিবরণ নেই": "No additional details",
    "ব্যক্তিগত তথ্য (শুধু অ্যাডমিন)": "Private information (admin only)",
    "নাম:": "Name:",
    "দেওয়া হয়নি": "Not provided",
    "ফোন:": "Phone:",
    "আবেদনকারী:": "Applicant:",
    "নম্বর দেওয়া হয়নি": "No phone number provided",
    লুকান: "Hide",
    "তথ্য দেখান": "Show information",
    "উপযুক্ত দল নির্ধারণ": "Assign an eligible team",
    "আবেদনে ইতিমধ্যে সক্রিয়/সম্পন্ন কার্যক্রম রয়েছে। দ্বৈত dispatch বন্ধ।": "This request already has an active or completed mission. Duplicate dispatch is blocked.",
    "আগে আবেদন যাচাই করুন।": "Verify the request first.",
    "উপযুক্ত প্রস্তুত দল নেই": "No eligible team is ready",
    "দলের সক্ষমতা/এলাকা/ব্যস্ততা দেখুন। অন্য উপযুক্ত দল প্রস্তুত হলে এই আবেদনেই ফিরে বরাদ্দ দিন।": "Check team capabilities, operating areas and workload. Return to this request when an eligible team is ready.",
    "সক্ষমতা:": "Capabilities:",
    "· সদস্য": "· Members",
    "যাচাইকৃত সংগঠন · এলাকা ও সক্ষমতা মেলে · প্রস্তুত · সক্রিয় কাজ নেই": "Verified organization · matching area and capabilities · ready · no active mission",
    "এই দল নির্ধারণ করুন": "Assign this team",
    "যাচাই সিদ্ধান্ত": "Verification decision",
    "অ্যাডমিন নোট:": "Admin note:",
    "যাচাইকৃত করুন": "Mark as verified",
    "স্পষ্টকরণ চাই": "Request clarification",
    প্রত্যাখ্যান: "Reject",
    "বরাদ্দ ও কার্যক্রমের ইতিহাস": "Assignment and mission history",
    "কার্যক্রম দেখুন": "View mission",
    "এখনো কোনো দল বরাদ্দ নেই।": "No team has been assigned yet.",
    "পুনর্বণ্টনে আগের record মুছবে না।": "Reassignment keeps the previous record.",
    "যাচাই সিদ্ধান্ত নিশ্চিত করুন": "Confirm verification decision",
    "আবেদনের যাচাই-অবস্থা ও ট্র্যাকিং হালনাগাদ হয়েছে।": "The request's verification status and tracking have been updated.",
    "কারণ / অ্যাডমিন নোট": "Reason / admin note",
    বাতিল: "Cancel",
    "নিশ্চিত করুন": "Confirm",
    "দল নির্ধারণ নিশ্চিত করুন": "Confirm team assignment",
    "দলকে এই যাচাইকৃত আবেদন দেওয়া হবে। দলনেতার স্বীকৃতি বাকি থাকবে।": "This verified request will be assigned to the team and will await the team leader's acknowledgement.",
    "দল নির্ধারিত; নিচের কার্যক্রম লিংক থেকে অগ্রগতি দেখুন।": "Team assigned. Follow progress using the mission link below.",
    "বরাদ্দ নিশ্চিত করুন": "Confirm assignment",
    "সংগঠন যাচাই": "Organization verification",
    "নিবন্ধন ও প্রশাসকের জবাবদিহি যাচাই করুন": "Review registration and administrator accountability",
    "বিস্তারিত ও যাচাই": "Details and verification",
    "সংগঠনের পরিচয় পর্যালোচনা": "Review organization identity",
    "প্রশাসক:": "Administrator:",
    "আইডি:": "ID:",
    "প্রত্যাখ্যানের কারণ": "Reason for rejection",
    "যাচাই নিশ্চিত করুন": "Confirm verification",
    "প্রত্যাখ্যান নিশ্চিত করুন": "Confirm rejection",
    "সরবরাহকারী ও সম্পদ": "Suppliers and resources",
    "সরবরাহকারী যোগ করুন": "Add supplier",
    "নির্বাচিত সরবরাহকারী": "Selected supplier",
    "সম্পদ দেখুন": "View resources",
    "-এর সম্পদ": "'s resources",
    "সম্পদ যোগ করুন": "Add resource",
    "টি ·": " units ·",
    "মজুদ আছে": "In stock",
    "মজুদ শেষ": "Out of stock",
    "এখনো কোনো সম্পদ যোগ হয়নি।": "No resources have been added yet.",
    "নতুন তথ্য সংরক্ষিত হয়েছে।": "New information has been saved.",
    নাম: "Name",
    ধরন: "Type",
    এলাকা: "Area",
    "যোগাযোগ (কাল্পনিক)": "Contact (fictional)",
    পরিমাণ: "Quantity",
    নোট: "Note",
    সংরক্ষণ: "Save",
    "০১২৩৪৫৬৭৮৯": "0123456789",
    "জেলা বেছে নিন": "Select a district",
    "উপজেলা বেছে নিন": "Select an upazila",
    "কতজন বিপদে আছেন তা লিখুন": "Enter the number of people in danger",
    "অন্তত একটি সাহায্য বেছে নিন": "Select at least one type of assistance",
    "সঠিক মোবাইল নম্বর লিখুন (যেমন: ০১৭XXXXXXXX)": "Enter a valid mobile number (e.g. 017XXXXXXXX)",
    "আপনার নাম লিখুন": "Enter your name",
    "বিপদগ্রস্ত ব্যক্তির সঙ্গে সম্পর্ক লিখুন": "Enter your relationship to the person in danger",
    "আবেদন গ্রহণ করা হয়েছে": "Request received",
    "আবেদন জমা হয়েছে; এখনো কোনো দল নির্ধারিত হয়নি। অ্যাডমিন তথ্য যাচাই করে পরবর্তী ব্যবস্থা নেবেন।": "Your request has been submitted; no team has been assigned yet. An admin will review the information and decide the next steps.",
    "আবেদন নম্বর": "Request number",
    "ট্র্যাকিং কোড": "Tracking code",
    অবস্থা: "Status",
    "অপেক্ষমাণ · যাচাই হবে": "Pending · awaiting verification",
    "এটি একটি প্রোটোটাইপ": "This is a prototype",
    "এই পর্দা কেবল ডিজাইন দেখানোর জন্য। আবেদন কোনো প্রকৃত উদ্ধারকারীর কাছে পাঠানো হয়নি।": "This screen is for demonstration only. Your request has not been sent to any real rescue team.",
    "রেফারেন্স ও কোড লিখে রাখুন। শুধু এই ব্রাউজারে পরীক্ষার জন্য সংরক্ষিত।": "Keep your reference and code. They are stored only in this browser for testing.",
    "আবেদন ট্র্যাক করুন": "Track a request",
    "আরেকটি আবেদন করুন": "Submit another request",
    হোম: "Home",
    মানচিত্র: "Map",
    "সাহায্যের আবেদন": "Request help",
    "কয়েক মিনিটেই আবেদন করুন। কোনো অ্যাকাউন্ট লাগবে না।": "Apply in a few minutes. No account needed.",
    "ফর্ম বন্ধ করুন": "Close form",
    "ফর্মে কিছু তথ্য ঠিক করতে হবে": "Some form details need attention",
    "টি ঘরে ভুল বা তথ্য বাকি আছে। লাল চিহ্নিত ঘরগুলো দেখুন।": " fields have errors or missing information. Check the fields marked in red.",
    "আবেদন পাঠানো যায়নি": "Could not submit the request",
    "ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।": "Check your internet connection and try again.",
    "আবেদনের ধরন": "Request type",
    "নিজের জন্য": "For myself",
    "অন্যের পক্ষ থেকে": "On behalf of someone else",
    "আপনার ও বিপদগ্রস্ত ব্যক্তির তথ্য": "Your details and the person in danger",
    "আপনার নাম": "Your name",
    "যিনি আবেদন করছেন": "The person submitting this request",
    "বিপদগ্রস্ত ব্যক্তির সঙ্গে সম্পর্ক": "Relationship to the person in danger",
    "যেমন: প্রতিবেশী, আত্মীয়": "For example: neighbor, relative",
    "বিপদগ্রস্ত ব্যক্তির নাম": "Name of the person in danger",
    "আপনার যোগাযোগের নম্বর": "Your contact number",
    "বিপদগ্রস্ত ব্যক্তির নম্বর না থাকলে আপনার নম্বর দিন।": "Use your number if the person in danger does not have one.",
    উপজেলা: "Upazila",
    "আগে জেলা বেছে নিন": "Select a district first",
    "কতজন মানুষ বিপদে আছেন": "How many people are in danger?",
    "যেমন: ৫": "For example: 5",
    "কী ধরনের সাহায্য প্রয়োজন": "What kind of help is needed?",
    "যোগাযোগের নম্বর": "Contact number",
    "বিপদগ্রস্ত স্থানের যোগাযোগ নম্বর": "Contact number at the affected location",
    "এই নম্বর জনসমক্ষে দেখানো হবে না।": "This number will not be shown publicly.",
    "০১৭XXXXXXXX": "017XXXXXXXX",
    "জরুরি অবস্থার সংক্ষিপ্ত বিবরণ": "Briefly describe the emergency",
    "কোথায় আছেন, পানি কতটা উঁচু, কারও চিকিৎসা দরকার কি না…": "Where you are, how high the water is, whether anyone needs medical care…",
    "পাঠানো হচ্ছে...": "Submitting...",
    "আবেদন পাঠান": "Submit request",
    "শুধু কাল্পনিক তথ্য দিন; স্থানীয় ডেমোতে বাস্তব গোপনীয়তা নিশ্চিত হয় না।": "Use fictional information only; this local demo does not provide real privacy protection.",
    "ডেমো তথ্যনীতি": "Demo privacy policy",
    "জেলা বা উপজেলা খুঁজুন": "Search district or upazila",
    "জেলা বা উপজেলার নাম লিখুন": "Enter a district or upazila name",
    "কোনো এলাকা পাওয়া যায়নি": "No matching areas",
    "মানচিত্র নিয়ন্ত্রণ": "Map controls",
    "বড় করুন": "Zoom in",
    "ছোট করুন": "Zoom out",
    "আগের অবস্থায়": "Reset view",
    "মানচিত্রের তথ্য লোড হচ্ছে...": "Loading map information...",
    "মানচিত্রের তথ্য আনা যায়নি": "Could not load map information",
    "ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন। আপনি চাইলে মানচিত্র ছাড়াই আবেদন করতে পারেন।": "Check your internet connection and try again. You can also apply without using the map.",
    "আবার চেষ্টা করুন": "Try again",
    "আবেদন করুন": "Apply for help",
    "বাংলাদেশের প্রোটোটাইপ মানচিত্র। জেলার সীমানা ও উপজেলার অবস্থান আনুমানিক।": "Prototype map of Bangladesh. District boundaries and upazila locations are approximate.",
    "প্রোটোটাইপ মানচিত্র · সীমানা আনুমানিক ও নমুনা তথ্য, প্রকৃত জরিপ নয়": "Prototype map · approximate boundaries and sample data, not a real survey",
    "প্রোটোটাইপ অবস্থা পরিবর্তন": "Change prototype state",
    "ডেমো অবস্থা": "Demo state",
    স্বাভাবিক: "Normal",
    "লোড হচ্ছে": "Loading",
    ত্রুটি: "Error",
    "আবেদন নেই": "No requests",
    সংকেত: "Map legend",
    "সাহায্যের আবেদন রয়েছে": "Help requests reported",
    "যাচাইকৃত বন্যাকবলিত এলাকা": "Verified flood-affected area",
    "বর্তমানে যাচাইকৃত বন্যা-সংক্রান্ত তথ্য নেই": "No verified flood information currently available",
    "আবেদন থাকা মানেই পুরো উপজেলা বন্যাকবলিত নয়। আবেদন ও যাচাইকৃত বন্যার তথ্য আলাদা স্তর।": "A request does not mean the entire upazila is flooded. Requests and verified flood data are separate layers.",
    "এখনো কোনো আবেদন নেই": "No requests yet",
    "নতুন আবেদন এলে এখানে এলাকাভিত্তিক সারসংক্ষেপ দেখা যাবে।": "Area summaries will appear here when new requests arrive.",
    "এই এলাকায় কোনো আবেদন নেই": "No requests in this area",
    "অন্য এলাকা বেছে নিন, অথবা আপনি বিপদে থাকলে আবেদন করুন।": "Choose another area, or submit a request if you need help.",
    "একটি এলাকা বেছে নিন": "Choose an area",
    "মানচিত্রে লাল চিহ্নে ক্লিক করুন অথবা উপরে নাম লিখে খুঁজুন।": "Click a red marker on the map or search by name above.",
    অপেক্ষমাণ: "Pending",
    যাচাইধীন: "Under review",
    "সাহায্য চলমান": "Assistance in progress",
    সম্পন্ন: "Completed",
    "যাচাইকৃত বন্যাকবলিত": "Verified flood-affected",
    "যাচাইকৃত বন্যার তথ্য নেই": "No verified flood data",
    "টি সাহায্যের আবেদন": " help requests",
    "প্রয়োজনীয় সহায়তা": "Assistance needed",
    "আবেদনের অবস্থা (মোট)": "Request status (total)",
    "গোপনীয়তার জন্য নাম, ফোন নম্বর ও সঠিক ঠিকানা এখানে দেখানো হয় না।": "For privacy, names, phone numbers and exact addresses are not shown here.",
    "এই এলাকায় সাহায্যের আবেদন": "Request help in this area",
    "সহায়তার আবেদনসমূহ": "Help requests",
    "গোপনীয়তা-সুরক্ষিত সারসংক্ষেপ; আবেদন শুধু সুপার অ্যাডমিন দলকে বরাদ্দ করেন": "Privacy-safe summaries; only the super admin assigns requests to teams",
    "ব্যক্তিগতভাবে আবেদন গ্রহণ করা যায় না। আপনার দলের জন্য বরাদ্দ হলে দলনেতা কার্যক্রমের স্বীকৃতি দেবেন।": "Requests cannot be accepted individually. If assigned to your team, the team leader will acknowledge the mission.",
    "সব উপজেলা": "All upazilas",
    "নিরাপদ আবেদন সারসংক্ষেপ": "Safe request summary",
    "নাম, ফোন, নির্দিষ্ট ঠিকানা ও ব্যক্তিগত বিবরণ এখানে দেখানো হয় না।": "Names, phone numbers, exact addresses and private details are not shown here.",
    "সারসংক্ষেপ বন্ধ করুন": "Close summary",
    "জন ·": " people ·",
    "সারসংক্ষেপ দেখুন": "View summary",
    "কোনো আবেদন পাওয়া যায়নি": "No requests found",
    "অন্য এলাকা দিয়ে চেষ্টা করুন।": "Try a different area.",
    "সাহায্যের আবেদন জানান": "Submit a help request",
    "অ্যাকাউন্ট ছাড়াই কয়েকটি তথ্য দিয়ে আবেদন পাঠান।": "Send a request with a few details. No account needed.",
    "আবেদন যাচাই করা হয়": "Requests are reviewed",
    "প্রশাসকরা তথ্য যাচাই করে অগ্রাধিকার ঠিক করেন।": "Administrators check the information and set priorities.",
    "উপযুক্ত স্বেচ্ছাসেবক দল নির্ধারণ করা হয়": "An eligible volunteer team is assigned",
    "এলাকা ও সক্ষমতা দেখে সবচেয়ে কাছের দল বেছে নেওয়া হয়।": "A nearby team is chosen based on its operating area and capabilities.",
    "সহায়তা পৌঁছে দেওয়া হয়": "Assistance is delivered",
    "দলটি সহায়তা পৌঁছে কার্যক্রমের অবস্থা হালনাগাদ করে।": "The team delivers assistance and updates mission progress.",
    "মোট সাহায্যের আবেদন": "Total help requests",
    "যাচাইধীন আবেদন": "Requests under review",
    "সহায়তা সম্পন্ন": "Assistance completed",
    "কোনো অ্যাকাউন্ট বা নিবন্ধন ছাড়াই আবেদন করা যায়": "No account or registration needed to request help",
    "দুর্যোগে, মানুষের পাশে মানুষ": "In times of crisis, we stand together",
    "বন্যায় আটকে পড়েছেন? আপনার বা অন্য কারও সাহায্যের আবেদন জানান।": "Stranded by flooding? Request help for yourself or someone else.",
    "সাহায্যের আবেদন করুন": "Request help",
    "বন্যা পরিস্থিতি দেখুন": "View flood situation",
    "জনসমক্ষে নাম/ফোন দেখানো হয় না। ডেমোতে শুধু কাল্পনিক তথ্য দিন।": "Names and phone numbers are not shown publicly. Use fictional information in this demo.",
    "আগের আবেদন ট্র্যাক করুন": "Track an existing request",
    "বন্যার পানিতে নৌকায় দুজন মানুষ": "Two people in a boat in floodwater",
    "স্থানীয় স্বেচ্ছাসেবক দলের মাধ্যমে সহায়তা সমন্বয় করা হয়": "Assistance is coordinated through local volunteer teams",
    "বাংলাদেশের কোথায় সাহায্য প্রয়োজন?": "Where is help needed in Bangladesh?",
    "জেলা ও উপজেলা অনুযায়ী সাহায্যের আবেদন দেখুন এবং মানবিক সহায়তায় এগিয়ে আসুন।": "Explore help requests by district and upazila, and take part in humanitarian assistance.",
    "পূর্ণ পর্দায় মানচিত্র দেখুন": "View full-screen map",
    "জরুরি পরিস্থিতির সারসংক্ষেপ": "Emergency situation overview",
    "নমুনা তথ্য · সরাসরি পরিসংখ্যান নয়": "Sample data · not live statistics",
    "SHARA কীভাবে কাজ করে": "How SHARA works",
    ধাপ: "Step",
    "আপনার সহযোগিতা হতে পারে কারও বেঁচে থাকার আশার আলো": "Your support could give someone hope",
    "আপনার এলাকার মানুষের পাশে দাঁড়াতে স্বেচ্ছাসেবক হিসেবে যুক্ত হোন।": "Join as a volunteer to stand beside people in your community.",
    "স্বেচ্ছাসেবক হিসেবে নিবন্ধন": "Register as a volunteer",
    "সংগঠন হিসেবে নিবন্ধন": "Register an organization",
    "বাংলাদেশের বন্যা পরিস্থিতি": "Flood situation in Bangladesh",
    "কোথায় সাহায্যের প্রয়োজন, দেখুন এলাকার ভিত্তিতে": "See where help is needed, area by area",
    "আমার দলের কার্যক্রম": "My team's missions",
    কার্যক্রমসমূহ: "Missions",
    "বর্তমান কাজ ও পূর্ববর্তী কার্যক্রম একই তালিকায়": "Current work and past missions in one place",
    "কার্যক্রম ফিল্টার": "Filter missions",
    "সব কার্যক্রম": "All missions",
    সক্রিয়: "Active",
    ইতিহাস: "History",
    "সমস্যা জানানো হয়েছে": "Problem reported",
    "সর্বশেষ:": "Last updated:",
    "কোনো কার্যক্রম নেই": "No missions",
    "ড্যাশবোর্ডে ফিরুন": "Back to dashboard",
    "সুপার অ্যাডমিন দল নির্ধারণের পর কার্যক্রম এখানে দেখা যাবে।": "Missions will appear here after the super admin assigns a team.",
    "কার্যক্রম পাওয়া যায়নি বা প্রবেশাধিকার নেই": "Mission not found or access denied",
    "নিজের কার্যক্রমে ফিরুন": "Back to my missions",
    "শুধু সংশ্লিষ্ট দলের সদস্য, সংগঠন প্রশাসক ও সুপার অ্যাডমিন দেখতে পারেন।": "Only the assigned team's members, organization administrator and super admin can view this mission.",
    "কার্যক্রম হালনাগাদ হয়েছে। সব সংশ্লিষ্ট পোর্টাল ও ট্র্যাকিংয়ে অবস্থা বদলেছে।": "Mission updated. Its status has changed in the related portals and tracking.",
    "কার্যক্রমের তালিকায় ফিরুন": "Back to missions",
    "দল নির্ধারিত": "Team assigned",
    "নেতার স্বীকৃতি": "Leader acknowledgement",
    চলমান: "In progress",
    "সর্বশেষ ধাপ:": "Last stage:",
    "সমাধানের পর একই ধাপে ফিরতে হবে; স্বীকৃতি বা শুরুর ধাপ বাদ দেওয়া যাবে না।": "After resolving the issue, return to the same stage; acknowledgement and starting the mission cannot be skipped.",
    "এই কার্যক্রম বন্ধ। পুনর্বণ্টন হলে আলাদা বরাদ্দের record থাকবে।": "This mission is closed. Any reassignment will have a separate assignment record.",
    "কার্যক্রমের বিবরণ": "Mission details",
    দল: "Team",
    সংগঠন: "Organization",
    সহায়তা: "Assistance",
    "বিপদগ্রস্ত মানুষ": "People in danger",
    "জমার সময়": "Submitted at",
    "দলের অপারেশনাল তথ্য": "Team operational information",
    "ব্যক্তিগত যোগাযোগের জন্য সুপার অ্যাডমিনের সঙ্গে সমন্বয় করুন।": "Coordinate private contact information with the super admin.",
    "ব্যক্তিগত নাম/ফোন শুধু অ্যাডমিন view-তে। দলের অপারেশনাল তথ্য প্রকাশ্যে শেয়ার করবেন না।": "Private names and phone numbers are visible only to admins. Do not share team operational information publicly.",
    "অগ্রগতি দলনেতা দেবেন। প্রয়োজনে আপনি বাতিল/ব্যর্থ চিহ্নিত করে পুনর্বণ্টন করতে পারেন।": "The team leader updates progress. You can cancel or mark the mission as failed for reassignment if needed.",
    "এই view-তে পর্যবেক্ষণ করতে পারবেন; শুধু নিযুক্ত দলনেতা অগ্রগতি পরিবর্তন করেন।": "This view is read-only; only the assigned team leader can change progress.",
    "দলের পক্ষে স্বীকৃতি দিন": "Acknowledge on behalf of the team",
    "কার্যক্রম শুরু করুন": "Start mission",
    "সমস্যা সমাধান হয়েছে — আগের ধাপে ফিরুন": "Problem resolved — return to previous stage",
    "সম্পন্ন চিহ্নিত করুন": "Mark as completed",
    "অগ্রগতির নোট দিন": "Add a progress note",
    "সমস্যা জানান": "Report a problem",
    "বাতিল ও পুনর্বণ্টন": "Cancel and reassign",
    "ব্যর্থ চিহ্নিত করুন": "Mark as failed",
    "আবেদন ও বরাদ্দের ইতিহাস": "Request and assignment history",
    "পরিবর্তনের ইতিহাস": "Change history",
    "অপারেশনাল নোট": "Operational note",
    "বাতিল/ব্যর্থ হলে পুরোনো বরাদ্দ মুছবে না; অ্যাডমিন একই আবেদনে উপযুক্ত নতুন দল নির্ধারণ করতে পারবেন।": "Cancelled or failed assignments are kept. The admin can assign another eligible team to the same request.",
    "ফিরে যান": "Go back",
    "বেসরকারি উন্নয়ন সংস্থা (এনজিও)": "Non-governmental organization (NGO)",
    "অলাভজনক / দাতব্য সংস্থা": "Nonprofit / charitable organization",
    "স্থানীয় কমিউনিটি সংগঠন": "Local community organization",
    "সরকারি প্রতিষ্ঠান": "Government institution",
    "শিক্ষাপ্রতিষ্ঠানভিত্তিক সংগঠন": "Educational institution-based organization",
    "নিবন্ধনের আবেদন গ্রহণ করা হয়েছে": "Registration request received",
    "-এর তথ্য ডেমো অ্যাডমিন যাচাই তালিকায় রয়েছে। কোনো বাস্তব ইমেইল পাঠানো হয় না।": "'s information is in the demo admin verification queue. No real email is sent.",
    "যাচাই চলছে": "Verification in progress",
    "সুপার অ্যাডমিন অনুমোদন না করা পর্যন্ত সংগঠনটি যাচাইকৃত হিসেবে দেখানো হবে না এবং দল পরিচালনার সুবিধা সক্রিয় হবে না।": "Your organization will not be shown as verified and team management will remain unavailable until the super admin approves it.",
    "নিবন্ধনের অবস্থা দেখুন": "View registration status",
    "হোমে ফিরে যান": "Back to home",
    "সংগঠনের অংশীদারিত্ব": "Organization partnership",
    "স্বেচ্ছাসেবক দল গঠন ও মানবিক সহায়তা সমন্বয়ের জন্য আপনার সংগঠনের তথ্য দিন।": "Tell us about your organization to form volunteer teams and coordinate humanitarian assistance.",
    "নাম, বিবরণ, প্রশাসকের নাম, জেলা ও অন্তত একটি লোকেশন দিন।": "Provide a name, description, administrator name, district and at least one location.",
    "যাচাই প্রয়োজন": "Verification required",
    "নিবন্ধনের পর আপনার সংগঠনের অবস্থা “যাচাই চলছে” থাকবে। সংগঠন আইডি ও তৈরির তারিখ স্বয়ংক্রিয়ভাবে তৈরি হবে।": "After registration, your organization will be marked “Verification in progress”. Its ID and creation date are generated automatically.",
    "দায়িত্বশীল প্রশাসকের নাম (ডেমো)": "Responsible administrator's name (demo)",
    "এই নামে সংগঠন-সংযুক্ত ডেমো অ্যাকাউন্ট তৈরি হবে। বাস্তব তথ্য দেবেন না।": "A demo account linked to this organization will be created under this name. Do not enter real information.",
    "সংগঠনের পরিচিতি": "Organization identity",
    "সংগঠনটি কী এবং কীভাবে মানবিক সহায়তায় কাজ করে": "What your organization does and how it supports humanitarian work",
    "সংগঠনের নাম": "Organization name",
    "যেমন: সবুজ বাংলা ফাউন্ডেশন": "For example: Sabuj Bangla Foundation",
    "সংগঠনের ধরন": "Organization type",
    "ধরন বেছে নিন": "Select a type",
    "সংক্ষিপ্ত বিবরণ": "Short description",
    "সংগঠনের লক্ষ্য, অভিজ্ঞতা এবং প্রধান কার্যক্রম সংক্ষেপে লিখুন।": "Briefly describe your organization's purpose, experience and main activities.",
    "আপনাদের কাজ সম্পর্কে লিখুন…": "Tell us about your work…",
    "যোগাযোগের তথ্য": "Contact information",
    "যাচাই ও জরুরি সমন্বয়ের জন্য দায়িত্বশীল যোগাযোগ": "Responsible contact for verification and emergency coordination",
    "যোগাযোগের ইমেইল": "Contact email",
    "যোগাযোগের ফোন": "Contact phone",
    "কার্যএলাকা ও লোকেশন": "Operating areas and locations",
    "একাধিক জেলা এবং সুনির্দিষ্ট উপজেলা নির্বাচন করা যাবে": "You can select multiple districts and specific upazilas",
    "কার্যপরিচালনার জেলা": "Operating districts",
    "সংগঠনটি যেসব জেলায় নিয়মিত কাজ করে": "Districts where your organization works regularly",
    "সুনির্দিষ্ট লোকেশন": "Specific locations",
    "লোকেশনের জেলা": "Location district",
    "একটি জেলা বেছে নিয়ে নিচের উপজেলা যোগ করুন। পরে অন্য জেলা থেকেও যোগ করতে পারবেন।": "Choose a district and add upazilas below. You can then add locations from other districts.",
    "নির্বাচিত লোকেশন (": "Selected locations (",
    "যাচাইয়ের পর যা করতে পারবেন": "What you can do after verification",
    "স্বেচ্ছাসেবক ব্যবস্থাপনা": "Volunteer management",
    "সদস্য যোগ বা অপসারণ এবং সক্রিয় দল দেখা": "Add or remove members and view active teams",
    "দল গঠন ও প্রোফাইল": "Team creation and profiles",
    "নতুন দল তৈরি এবং সংগঠনের তথ্য হালনাগাদ": "Create teams and update organization information",
    "নিবন্ধনের আবেদন জমা দিন": "Submit registration request",
    "জমা দেওয়ার মাধ্যমে আপনি প্রদত্ত তথ্য সঠিক বলে নিশ্চিত করছেন।": "By submitting, you confirm that the information provided is correct.",
    "সংগঠনের প্রশাসন পোর্টাল": "Organization administration portal",
    "সংগঠনের প্রোফাইল": "Organization profile",
    "সদস্য অনুমোদন, ছোট দল গঠন ও কার্যক্রম পর্যবেক্ষণ করতে পারবেন।": "You can approve members, form small teams and monitor missions.",
    "নিবন্ধন জমা হয়েছে। সুপার অ্যাডমিন অনুমোদনের আগে পরিচালনার সুবিধা বন্ধ থাকে।": "Registration submitted. Management features stay unavailable until super admin approval.",
    "সদস্যপদ অপেক্ষমাণ": "Pending memberships",
    "ছোট দল": "Small teams",
    "সক্রিয় কার্যক্রম": "Active missions",
    দেখুন: "View",
    "পরবর্তী করণীয়": "Next steps",
    "সদস্যপদের অনুরোধ পর্যালোচনা": "Review membership requests",
    "নতুন ছোট দল গঠন": "Create a small team",
    "দলের কার্যক্রম পর্যবেক্ষণ": "Monitor team missions",
    "দল dispatch করেন সুপার অ্যাডমিন। দলের নেতা কার্যক্রমের স্বীকৃতি ও অগ্রগতি দেন।": "The super admin dispatches teams. The team leader acknowledges missions and updates progress.",
    "অনুমোদিত স্বেচ্ছাসেবক": "Approved volunteers",
    "সদস্যপদের অনুরোধ": "Membership requests",
    "সংগঠনের অনুমোদিত সদস্যরাই ছোট দলে যোগ্য": "Only approved organization members are eligible to join small teams",
    "সদস্য খুঁজুন": "Search members",
    "নাম দিয়ে খুঁজুন": "Search by name",
    "ছোট দল:": "Small team:",
    "বরাদ্দ নেই": "Not assigned",
    "অনুরোধ অপেক্ষমাণ": "Request pending",
    অনুমোদন: "Approve",
    "সদস্যপদ অপসারণ": "Remove membership",
    "দলে যুক্ত করুন": "Add to team",
    "অপসারণের আগে দল সম্পাদনা করে সদস্যকে সরান। সক্রিয় কার্যক্রমে দল সম্পাদনা বন্ধ।": "Edit the team to remove the member first. Team editing is locked during active missions.",
    "কোনো সদস্য বা অনুরোধ নেই": "No members or requests",
    "নতুন অনুরোধ এলে এখানে দেখা যাবে।": "New requests will appear here.",
    "সদস্যপদ অনুমোদন করবেন?": "Approve membership?",
    "প্রত্যাখ্যান / অপসারণের কারণ": "Reason for rejection / removal",
    "সদস্যপদ হালনাগাদ হয়েছে। স্বেচ্ছাসেবকের পোর্টালেও অবস্থা বদলেছে।": "Membership updated. The volunteer's portal now shows the new status too.",
    কারণ: "Reason",
    "অনুমোদন পেলে সদস্য ছোট দলে যোগ্য হবেন; স্বয়ংক্রিয়ভাবে দলে যুক্ত হবেন না।": "Approval makes this member eligible for a small team; it does not automatically add them to one.",
    "প্রোফাইল সম্পাদনা": "Edit profile",
    "পরিবর্তন সংরক্ষিত হয়েছে।": "Changes saved.",
    প্রশাসক: "Administrator",
    ইমেইল: "Email",
    ফোন: "Phone",
    লোকেশন: "Locations",
    "আইডি (read-only)": "ID (read-only)",
    "তৈরির সময় (read-only)": "Created at (read-only)",
    "সংগঠনের প্রোফাইল সম্পাদনা": "Edit organization profile",
    "নাম, বিবরণ ও জেলা দিন।": "Provide a name, description and district.",
    "যাচাই-অবস্থা, প্রশাসক সম্পর্ক, আইডি ও তৈরির সময় পরিবর্তন করা যাবে না।": "Verification status, administrator links, ID and creation date cannot be changed.",
    "কোনো ছোট দলের ব্যবহৃত জেলা সরানোর আগে সেই দলের কার্যএলাকা পরিবর্তন করুন।": "Before removing a district used by a small team, update that team's operating areas.",
    বিবরণ: "Description",
    "দল ও প্রাপ্যতা": "Teams and availability",
    "ছোট দলসমূহ": "Small teams",
    "সদস্যপদ, সক্ষমতা ও বর্তমান কাজের অবস্থা": "Membership, capabilities and current workload",
    "দল খুঁজুন": "Search teams",
    "দল বা এলাকা দিয়ে খুঁজুন": "Search by team or area",
    "এলাকা:": "Area:",
    "নেতা:": "Leader:",
    "সক্রিয় কার্যক্রমে ব্যস্ত": "Busy with an active mission",
    "দল দেখুন / সম্পাদনা": "View / edit team",
    "এখনো কোনো ছোট দল নেই": "No small teams yet",
    "ছোট দল গঠন": "Create a small team",
    "অনুমোদিত সদস্যদের নিয়ে দল তৈরি করুন।": "Create a team from approved members.",
    "দল পাওয়া যায়নি বা প্রবেশাধিকার নেই": "Team not found or access denied",
    "দলের তালিকা": "Team list",
    "ছোট দল দেখুন / সম্পাদনা": "View / edit small team",
    "নেতা অবশ্যই নির্বাচিত অনুমোদিত সদস্যদের একজন হবেন": "The leader must be one of the selected approved members",
    "সক্রিয় কার্যক্রম থাকায় সম্পাদনা বন্ধ। আগে কার্যক্রম শেষ করুন।": "Editing is locked during an active mission. Complete the mission first.",
    "দলের নাম": "Team name",
    "কার্যপরিচালনার জেলা (অন্তত একটি)": "Operating districts (at least one)",
    "সদস্য নেই। আগে সদস্যপদ অনুমোদন করুন। অন্য দলে থাকা সদস্য এখানে যোগ করা যায় না।": "No members available. Approve memberships first. Members of other teams cannot be added here.",
    দলনেতা: "Team leader",
    "সদস্যদের মধ্য থেকে নেতা বেছে নিন": "Choose a leader from the selected members",
    "দলের প্রাপ্যতা": "Team availability",
    "সহায়তা প্রদানের সক্ষমতা": "Assistance capabilities",
    "তালিকায় ফিরুন": "Back to list",
    "দল সংরক্ষণ": "Save team",
    "ডেমো লগইন": "Demo login",
    "একটি নমুনা অ্যাকাউন্ট বেছে নিন": "Choose a sample account",
    "প্রকৃত authentication নয়": "Not real authentication",
    "কোনো পাসওয়ার্ড লাগে না। একই ব্রাউজারে অ্যাকাউন্ট বদলে workflow পরীক্ষা করা যায়। শুধু কাল্পনিক তথ্য ব্যবহার করুন।": "No password is needed. Switch accounts in the same browser to test workflows. Use fictional information only.",
    "নমুনা অ্যাকাউন্ট": "Sample account",
    "সুপার অ্যাডমিন": "Super admin",
    "সংগঠন প্রশাসক": "Organization admin",
    স্বেচ্ছাসেবক: "Volunteer",
    "ডেমোতে প্রবেশ করুন": "Enter demo",
    "স্বেচ্ছাসেবক নিবন্ধন": "Volunteer registration",
    "সংগঠন নিবন্ধন": "Organization registration",
    "আবেদনের অগ্রগতি": "Request progress",
    "রেফারেন্স ও প্রাপ্ত ট্র্যাকিং কোড দিয়ে নমুনা অগ্রগতি দেখুন": "Use your reference and tracking code to view sample progress",
    "সিমুলেটেড ব্যক্তিগত ট্র্যাকিং": "Simulated private tracking",
    "কোড ও তথ্য localStorage-এ থাকে; এটি production security নয়। এখানে নাম বা ফোন দেখানো হয় না। নমুনা: SH-24-0412 / DEMO-412": "Codes and data are stored in localStorage; this is not production security. Names and phone numbers are not shown here. Example: SH-24-0412 / DEMO-412",
    "রেফারেন্স বা কোড মেলেনি। জমার নিশ্চিতকরণ থেকে সঠিক তথ্য দিন।": "Reference or code did not match. Use the details from your submission confirmation.",
    "আবেদনের রেফারেন্স": "Request reference",
    "ব্যক্তিগত ডেমো কোড": "Private demo code",
    "অগ্রগতি দেখুন": "View progress",
    "সর্বশেষ পরিবর্তন": "Last updated",
    "আবেদন পাওয়া মানেই উদ্ধারকারী দল নির্ধারিত নয়। যাচাই ও দল নির্ধারণ পৃথক ধাপ।": "Receiving a request does not mean a rescue team has been assigned. Verification and team assignment are separate steps.",
    "অতিরিক্ত তথ্য জমা হয়েছে; আবেদন আবার পর্যালোচনার অপেক্ষায়।": "Additional information submitted; your request is awaiting review again.",
    "পরিস্থিতির অতিরিক্ত তথ্য": "Additional situation details",
    "নাম/ফোন দেবেন না। এই তথ্য কেবল অ্যাডমিন পর্যালোচনায় ব্যবহার হবে।": "Do not include names or phone numbers. This information is used only for admin review.",
    "অতিরিক্ত তথ্য জমা দিন": "Submit additional information",
    "এই পৃষ্ঠায় আপনার প্রবেশাধিকার নেই": "You do not have access to this page",
    "নিজের পোর্টালে ফিরুন": "Back to my portal",
    "সঠিক ডেমো অ্যাকাউন্ট বেছে নিন। অন্য সংগঠন বা দলের সীমাবদ্ধ কার্যক্রম দেখা যায় না।": "Choose the correct demo account. Restricted work belonging to other organizations or teams cannot be viewed.",
    "ডেমো তথ্য ও গোপনীয়তা": "Demo data and privacy",
    "SHARA একটি frontend prototype। ফর্ম, প্রোফাইল ও কাজের তথ্য এই ব্রাউজারের localStorage-এ থাকে। বাস্তব নাম, ফোন, পাসওয়ার্ড বা সংবেদনশীল তথ্য দেবেন না।": "SHARA is a frontend prototype. Forms, profiles and mission information are stored in this browser's localStorage. Do not enter real names, phone numbers, passwords or sensitive information.",
    "Public map, request summaries ও tracking-এ ফোন/নাম দেখানো হয় না। ক্লায়েন্ট role guards প্রকৃত authentication বা authorization-এর বিকল্প নয়। ডেমো নিয়ন্ত্রণ থেকে তথ্য রিসেট করতে পারবেন। কোনো বাস্তব ইমেইল, SMS বা উদ্ধারকারী পাঠানো হয় না।": "The public map, request summaries and tracking do not show names or phone numbers. Client-side role guards are not a replacement for real authentication or authorization. You can reset data using demo controls. No real email, SMS or rescue team is sent.",
    "নাম, সঠিক মোবাইল, বর্তমান উপজেলা, অন্তত একটি কাজের এলাকা ও দক্ষতা দিন।": "Provide your name, a valid mobile number, current upazila, at least one operating area and skill.",
    "প্রোফাইল ও প্রাপ্যতা": "Profile and availability",
    "পরিচয়, কাজের এলাকা ও সক্ষমতা হালনাগাদ রাখুন": "Keep your identity, operating areas and capabilities up to date",
    "প্রোফাইল সংরক্ষিত। ড্যাশবোর্ডেও তথ্য হালনাগাদ হয়েছে।": "Profile saved. Your dashboard has been updated too.",
    "ডেমো নিবন্ধন": "Demo registration",
    "শুধু কাল্পনিক তথ্য দিন। কোনো পাসওয়ার্ড নেওয়া বা সংরক্ষণ করা হয় না; ডেমো লগইন দিয়ে পরে ফিরতে পারবেন।": "Use fictional information only. No password is collected or stored; you can return later through demo login.",
    "ব্যক্তিগত তথ্য": "Personal information",
    "পূর্ণ নাম": "Full name",
    "মোবাইল নম্বর": "Mobile number",
    "০১৭০০-০০০০০০": "01700-000000",
    "সদস্যপদের জন্য সংগঠন": "Organization for membership",
    "নির্বাচন করলে অনুরোধ যাবে, সরাসরি সদস্যপদ নয়। পরে সংগঠন খুঁজেও আবেদন করতে পারবেন।": "Selecting an organization sends a request, not instant membership. You can also find and apply to one later.",
    "পরে সংগঠন খুঁজব": "I'll find an organization later",
    "সদস্যপদ প্রোফাইল থেকে বদলানো যায় না।": "Membership cannot be changed from your profile.",
    "আমার সংগঠন দেখুন": "View my organization",
    "অবস্থান ও কাজের এলাকা": "Location and operating areas",
    "বর্তমান জেলা": "Current district",
    "বর্তমান উপজেলা": "Current upazila",
    "কাজ করতে আগ্রহী এলাকা (অন্তত একটি)": "Areas where you can work (at least one)",
    "দক্ষতা ও সক্ষমতা": "Skills and capabilities",
    "দক্ষতা (অন্তত একটি)": "Skills (at least one)",
    প্রাপ্যতা: "Availability",
    "বিশেষ সক্ষমতা": "Additional capabilities",
    "যানবাহন ব্যবহারের সুযোগ আছে": "I have access to a vehicle",
    "সাঁতার জানি": "I can swim",
    "নিবন্ধন সম্পন্ন করুন": "Complete registration",
    "পরিবর্তন সংরক্ষণ": "Save changes",
    "বর্তমান কার্যক্রম দেখুন": "View current mission",
    "আমার ছোট দল দেখুন": "View my small team",
    "সংগঠন ও দল বরাদ্দের অবস্থা": "Organization and team assignment status",
    "সদস্যপদের অনুরোধ দেখুন": "View membership requests",
    "সংগঠন খুঁজুন": "Find an organization",
    "আপনার বর্তমান অবস্থা ও পরবর্তী করণীয়": "Your current status and next steps",
    "আপনার দলের কার্যক্রম রয়েছে": "Your team has a mission",
    "আপনি একটি ছোট দলে যুক্ত আছেন": "You are in a small team",
    "সদস্যপদ অনুমোদিত · দল বরাদ্দ বাকি": "Membership approved · awaiting team assignment",
    "সদস্যপদ অনুমোদনের অপেক্ষায়": "Awaiting membership approval",
    "প্রথমে একটি সংগঠনে যোগ দিন": "Join an organization first",
    "সংগঠনের সদস্যপদ ও ছোট দলের বরাদ্দ আলাদা ধাপ। কার্যক্রম শুধু দলকে দেওয়া হয়।": "Organization membership and small-team assignment are separate steps. Missions are assigned only to teams.",
    "প্রাপ্যতা:": "Availability:",
    "সংগঠন:": "Organization:",
    "এখনো সদস্য নন": "Not a member yet",
    "এখনো বরাদ্দ নেই": "Not assigned yet",
    "আপনার বর্তমান সদস্যপদ ও দল অনুযায়ী প্রাসঙ্গিক কাজ দেখানো হচ্ছে।": "Relevant actions are shown based on your current membership and team.",
    "আমার কার্যক্রম ও ইতিহাস": "My missions and history",
    "সহায়তার আবেদন দেখুন": "View help requests",
    "আমার সংগঠন": "My organization",
    "সদস্যপদের অনুরোধ ও অনুমোদনের অবস্থা": "Membership requests and approval status",
    "সংগঠনে অনুমোদন পাওয়ার পরও ছোট দলে বরাদ্দের জন্য প্রশাসকের সিদ্ধান্ত প্রয়োজন।": "Even after organization approval, a small-team assignment requires an administrator's decision.",
    "কারণ:": "Reason:",
    "ছোট দলের বরাদ্দ দেখুন": "View small-team assignment",
    "এখনো কোনো সদস্যপদের অনুরোধ নেই": "No membership requests yet",
    "যাচাইকৃত সংগঠন বেছে অনুরোধ পাঠান।": "Choose a verified organization and send a request.",
    "ছোট দলের বরাদ্দের অপেক্ষায়": "Awaiting small-team assignment",
    "আগে সংগঠনে সদস্য হোন": "Join an organization first",
    "সংগঠনের প্রশাসক অনুমোদিত সদস্যদের ছোট দলে যুক্ত করবেন।": "The organization administrator will add approved members to small teams.",
    "কার্যএলাকা:": "Operating areas:",
    "দলের সদস্য": "Team members",
    "— দলনেতা": "— Team leader",
    "— সদস্য": "— Member",
    "দলের কার্যক্রম দেখুন": "View team missions",
    "সংগঠনে সদস্য হোন, তারপর প্রশাসক আপনাকে ছোট দলে যুক্ত করবেন": "Join an organization, then its administrator can add you to a small team",
    "একটি অনুমোদিত সদস্যপদ বা অপেক্ষমাণ অনুরোধ থাকলে নতুন অনুরোধ বন্ধ থাকে। এটি ডেমোর এক-সংগঠন সদস্যপদ নীতি।": "New requests are blocked while you have approved membership or a pending request. This demo allows membership in one organization.",
    "নাম, ধরন বা জেলা দিয়ে খুঁজুন": "Search by name, type or district",
    "জন সদস্য ·": " members ·",
    "টি ছোট দল": " small teams",
    "সদস্যপদের অবস্থা দেখুন": "View membership status",
    "সংগঠনের যাচাই অপেক্ষমাণ": "Organization awaiting verification",
    "আবার আবেদন করুন": "Apply again",
    "সদস্যপদের অনুরোধ পাঠান": "Send membership request",
    "কোনো সংগঠন পাওয়া যায়নি": "No organizations found",
    "অন্য নাম বা জেলা দিয়ে খুঁজুন।": "Try another name or district.",
    পঞ্চগড়: "Panchagarh",
    ঠাকুরগাঁও: "Thakurgaon",
    নীলফামারী: "Nilphamari",
    লালমনিরহাট: "Lalmonirhat",
    কুড়িগ্রাম: "Kurigram",
    দিনাজপুর: "Dinajpur",
    রংপুর: "Rangpur",
    গাইবান্ধা: "Gaibandha",
    জয়পুরহাট: "Joypurhat",
    নওগাঁ: "Naogaon",
    বগুড়া: "Bogura",
    জামালপুর: "Jamalpur",
    শেরপুর: "Sherpur",
    চাঁপাইনবাবগঞ্জ: "Chapainawabganj",
    রাজশাহী: "Rajshahi",
    নাটোর: "Natore",
    সিরাজগঞ্জ: "Sirajganj",
    ময়মনসিংহ: "Mymensingh",
    নেত্রকোনা: "Netrokona",
    সুনামগঞ্জ: "Sunamganj",
    সিলেট: "Sylhet",
    মৌলভীবাজার: "Moulvibazar",
    হবিগঞ্জ: "Habiganj",
    কিশোরগঞ্জ: "Kishoreganj",
    টাঙ্গাইল: "Tangail",
    পাবনা: "Pabna",
    গাজীপুর: "Gazipur",
    নরসিংদী: "Narsingdi",
    ব্রাহ্মণবাড়িয়া: "Brahmanbaria",
    মানিকগঞ্জ: "Manikganj",
    ঢাকা: "Dhaka",
    নারায়ণগঞ্জ: "Narayanganj",
    কুষ্টিয়া: "Kushtia",
    মেহেরপুর: "Meherpur",
    চুয়াডাঙ্গা: "Chuadanga",
    ঝিনাইদহ: "Jhenaidah",
    মাগুরা: "Magura",
    রাজবাড়ী: "Rajbari",
    ফরিদপুর: "Faridpur",
    মুন্সিগঞ্জ: "Munshiganj",
    শরীয়তপুর: "Shariatpur",
    চাঁদপুর: "Chandpur",
    কুমিল্লা: "Cumilla",
    মাদারীপুর: "Madaripur",
    গোপালগঞ্জ: "Gopalganj",
    নড়াইল: "Narail",
    যশোর: "Jashore",
    সাতক্ষীরা: "Satkhira",
    খুলনা: "Khulna",
    বাগেরহাট: "Bagerhat",
    পিরোজপুর: "Pirojpur",
    ঝালকাঠি: "Jhalokathi",
    বরিশাল: "Barishal",
    ভোলা: "Bhola",
    পটুয়াখালী: "Patuakhali",
    বরগুনা: "Barguna",
    লক্ষ্মীপুর: "Lakshmipur",
    নোয়াখালী: "Noakhali",
    ফেনী: "Feni",
    চট্টগ্রাম: "Chattogram",
    কক্সবাজার: "Cox's Bazar",
    বান্দরবান: "Bandarban",
    রাঙ্গামাটি: "Rangamati",
    খাগড়াছড়ি: "Khagrachhari",
    "কুড়িগ্রাম সদর": "Kurigram Sadar",
    খাদ্য: "Food",
    "বিশুদ্ধ পানি": "Clean water",
    উদ্ধার: "Rescue",
    "গাইবান্ধা সদর": "Gaibandha Sadar",
    ওষুধ: "Medicine",
    চৌহালী: "Chowhali",
    আশ্রয়: "Shelter",
    "সুনামগঞ্জ সদর": "Sunamganj Sadar",
    কোম্পানীগঞ্জ: "Companiganj",
    কলমাকান্দা: "Kalmakanda",
    ইসলামপুর: "Islampur",
    ছাগলনাইয়া: "Chhagalnaiya",
    "কোম্পানীগঞ্জ (নোয়াখালী)": "Companiganj (Noakhali)",
    কয়রা: "Koyra",
    উলিপুর: "Ulipur",
    চিলমারী: "Chilmari",
    নাগেশ্বরী: "Nageshwari",
    ফুলছড়ি: "Fulchhari",
    সাঘাটা: "Saghata",
    কাজীপুর: "Kazipur",
    বেলকুচি: "Belkuchi",
    ছাতক: "Chhatak",
    দোয়ারাবাজার: "Dowarabazar",
    গোয়াইনঘাট: "Gowainghat",
    জৈন্তাপুর: "Jaintiapur",
    দুর্গাপুর: "Durgapur",
    দেওয়ানগঞ্জ: "Dewanganj",
    পরশুরাম: "Parshuram",
    ফুলগাজী: "Fulgazi",
    সুবর্ণচর: "Subarnachar",
    দাকোপ: "Dacope",
    কেরানীগঞ্জ: "Keraniganj",
    সাভার: "Savar",
    সীতাকুণ্ড: "Sitakunda",
    মিরসরাই: "Mirsharai",
    গঙ্গাচড়া: "Gangachara",
    কাউনিয়া: "Kaunia",
    মুলাদী: "Muladi",
    হিজলা: "Hizla",
    "আবেদনকারী নিজেই": "Applicant",
    "তিস্তা উদ্ধার দল": "Teesta Rescue Team",
    "ফেনী সবুজ দল": "Feni Green Team",
    "যমুনা তীর স্বেচ্ছাসেবক": "Jamuna Riverside Volunteers",
    "রহমান ট্রেডার্স": "Rahman Traders",
    খাদ্যসামগ্রী: "Food supplies",
    "সরবরাহে প্রস্তুত": "Ready to supply",
    "চাল (৫ কেজি প্যাকেট)": "Rice (5 kg pack)",
    "শুকনো খাবারের প্যাকেট": "Dry food packs",
    "চিড়া, গুড়, বিস্কুট": "Flattened rice, molasses, biscuits",
    "নদীপথ বোট সার্ভিস": "River Boat Service",
    পরিবহন: "Transport",
    "আংশিক প্রস্তুত": "Partially ready",
    "ইঞ্জিনচালিত নৌকা": "Motorized boat",
    সীমিত: "Limited",
    "২টি মেরামতাধীন": "2 under repair",
    "আরোগ্য মেডিক্যাল সাপ্লাই": "Arogya Medical Supply",
    "চিকিৎসা": "Medical",
    ওরস্যালাইন: "Oral rehydration salts",
    "মেয়াদ ২০২৭ পর্যন্ত": "Expires in 2027",
    "প্রাথমিক চিকিৎসা বক্স": "First-aid kit",
    "নতুন চালান অপেক্ষমাণ": "Awaiting new stock",
    "কার্যক্রম চলমান": "Mission in progress",
    জরুরি: "Urgent",
    মাঝারি: "Medium",
    সাধারণ: "Normal",
    ড্যাশবোর্ড: "Dashboard",
    "আমার কার্যক্রম": "My missions",
    "আমার ছোট দল": "My small team",
    "সহায়তার আবেদন": "Help requests",
    কার্যক্রম: "Missions",
    সারসংক্ষেপ: "Overview",
    "বন্যা পরিস্থিতি": "Flood situation",
    "সংগঠনের প্রশাসক": "Organization administrator",
    "ডেমো নিয়ন্ত্রণ": "Demo controls",
    "ডেমো / ডেভেলপার নিয়ন্ত্রণ": "Demo / developer controls",
    "শুধু এই ব্রাউজারের ডেমো": "Demo for this browser only",
    "এটি প্রকৃত লগইন নয়। অ্যাকাউন্ট বদলে একই নমুনা তথ্যের সম্পূর্ণ যাত্রা পরীক্ষা করুন। বাস্তব তথ্য দেবেন না।": "This is not a real login. Switch accounts to test complete journeys using the same sample data. Do not enter real information.",
    "ডেমো অ্যাকাউন্ট বদলান": "Switch demo account",
    "পাবলিক ব্যবহারকারী": "Public user",
    "ডেমো পৃষ্ঠা সূচি": "Demo page index",
    "সঠিক অ্যাকাউন্ট নির্বাচন না করলে সংরক্ষিত পৃষ্ঠায় প্রবেশ করা যাবে না।": "You cannot access protected pages without selecting the correct account.",
    "সব স্থানীয় পরিবর্তন মুছে যাবে": "All local changes will be deleted",
    "হ্যাঁ, ডেমো রিসেট করুন": "Yes, reset demo",
    "নমুনা তথ্য রিসেট করুন": "Reset sample data",
    "SHARA হোম": "SHARA home",
    "প্রধান মেনু": "Main menu",
    "প্রধান মেনু খুলুন": "Open main menu",
    "SHARA — Structured Humanitarian Assistance and Response Alliance। মানবিক সহায়তার একটি ডিজাইন প্রোটোটাইপ; প্রকৃত জরুরি সহায়তা পাঠানো হয় না।": "SHARA — Structured Humanitarian Assistance and Response Alliance. A humanitarian assistance design prototype; no real emergency response is dispatched.",
    "ফুটার মেনু": "Footer menu",
    "· ডেমো": "· Demo",
    "ড্যাশবোর্ড মেনু": "Dashboard menu",
    "পাবলিক হোম": "Public home",
    লগআউট: "Log out",
    "স্থানীয় ডেমো · তথ্য এই ব্রাউজারে থাকে · বাস্তব জরুরি সহায়তা নয়": "Local demo · data stays in this browser · not real emergency assistance",
    "কার্যক্রমের অনুমতি এখনো সক্রিয় নয়": "Mission management is not active yet",
    "নৌকা চালনা": "Boat operation",
    "প্রাথমিক চিকিৎসা": "First aid",
    "রান্না ও খাদ্য বিতরণ": "Cooking and food distribution",
    সাঁতার: "Swimming",
    "যোগাযোগ সমন্বয়": "Communication coordination",
    "যানবাহন চালনা": "Driving",
    "যাচাই অপেক্ষমাণ": "Awaiting verification",
    "তথ্য স্পষ্টকরণ প্রয়োজন": "Clarification required",
    "সদস্যপদ অনুমোদিত": "Membership approved",
    "নেতার স্বীকৃতি অপেক্ষমাণ": "Awaiting leader acknowledgement",
    "দল স্বীকৃতি দিয়েছে": "Team acknowledged",
    "কার্যক্রম বাতিল": "Mission cancelled",
    "কার্যক্রম ব্যর্থ": "Mission failed",
    প্রস্তুত: "Ready",
    "সীমিত প্রাপ্যতা": "Limited availability",
    অনুপলব্ধ: "Unavailable",
    "এখনই প্রস্তুত": "Ready now",
    "পুনরায় দল নির্ধারণ অপেক্ষমাণ": "Awaiting reassignment",
    "যাচাইকৃত · দল নির্ধারণ অপেক্ষমাণ": "Verified · awaiting team assignment",
    "সংগঠন যাচাইকৃত নয়": "Organization is not verified",
    "কার্যএলাকা মেলে না": "Operating area does not match",
    "দল প্রস্তুত নয়": "Team is not ready",
    "অন্য সক্রিয় কার্যক্রম রয়েছে": "Team has another active mission",
    "দলের নেতা নেই": "Team has no leader",
    "অনুমোদিত সদস্য প্রয়োজন": "Approved members required",
    "প্রয়োজনীয় সক্ষমতা অসম্পূর্ণ": "Required capabilities are missing",
    "সবুজ বাংলা ফাউন্ডেশন": "Sabuj Bangla Foundation",
    "তিস্তা মানবিক সহায়তা কেন্দ্র": "Teesta Humanitarian Assistance Center",
    "সুরমা নৌ-উদ্ধার": "Surma River Rescue",
    "প্ল্যাটফর্ম প্রশাসক": "Platform administrator",
    "আটকে আছেন": "Stranded",
    "শিশু ঝুঁকিতে": "Children at risk",
    "বয়স্ক ব্যক্তি": "Older people",
    "ডেমো: যাচাইয়ের পর দল নির্ধারিত": "Demo: team assigned after verification",
    "শুধু সুপার অ্যাডমিন এই কাজ করতে পারেন।": "Only the super admin can perform this action.",
    "এই সংগঠনে প্রবেশাধিকার নেই।": "You do not have access to this organization.",
    "সংগঠনের যাচাই সম্পন্ন হওয়া প্রয়োজন।": "The organization must be verified first.",
    "অ্যাকাউন্ট পাওয়া যায়নি।": "Account not found.",
    "আবেদনটি ইতিমধ্যে জমা হয়েছে।": "This request has already been submitted.",
    "আবেদনের তথ্য অসম্পূর্ণ।": "Request information is incomplete.",
    "ট্র্যাকিং কোডটি ব্যবহৃত হয়েছে। আবার চেষ্টা করুন।": "This tracking code is already in use. Please try again.",
    "অ্যাকাউন্টটি ইতিমধ্যে তৈরি হয়েছে।": "This account already exists.",
    "যাচাইকৃত সংগঠন বেছে নিন।": "Choose a verified organization.",
    "নিজের প্রোফাইলই সম্পাদনা করা যাবে।": "You can only edit your own profile.",
    "প্রশাসক সম্পর্ক সঠিক নয়।": "The administrator relationship is invalid.",
    "এই নামে সংগঠন ইতিমধ্যে রয়েছে।": "An organization with this name already exists.",
    "এই জেলায় ছোট দলের কার্যএলাকা রয়েছে। আগে দলটির কার্যএলাকা পরিবর্তন করুন।": "A small team operates in this district. Update the team's operating areas first.",
    "সংগঠন পাওয়া যায়নি।": "Organization not found.",
    "প্রত্যাখ্যানের কারণ লিখুন।": "Enter a reason for rejection.",
    "সক্রিয় কার্যক্রম থাকলে যাচাই-অবস্থা পরিবর্তন করা যাবে না।": "Verification status cannot change while there is an active mission.",
    "নিজের সদস্যপদের অনুরোধ পাঠান।": "Submit your own membership request.",
    "সংগঠন এখনো যাচাইকৃত নয়।": "The organization is not verified yet.",
    "সদস্যপদ বা অপেক্ষমাণ অনুরোধ ইতিমধ্যে রয়েছে।": "You already have membership or a pending request.",
    "অনুরোধ পাওয়া যায়নি।": "Request not found.",
    "কারণ লিখুন।": "Enter a reason.",
    "আগে সদস্যকে দল থেকে সরান; সক্রিয় কার্যক্রমে দল পরিবর্তন করা যাবে না।": "Remove the member from the team first; teams cannot change during an active mission.",
    "এই অনুরোধ আর সক্রিয় নয়।": "This request is no longer active.",
    "অন্য সংগঠনে সদস্যপদ রয়েছে।": "This member belongs to another organization.",
    "দলের মালিকানা বদলানো যাবে না।": "Team ownership cannot be changed.",
    "সক্রিয় কার্যক্রমের সময় দল সম্পাদনা বন্ধ।": "Team editing is locked during an active mission.",
    "দলের সব প্রয়োজনীয় তথ্য দিন।": "Provide all required team details.",
    "নেতা দলের সদস্যদের মধ্য থেকে বেছে নিন।": "Choose a leader from the team members.",
    "সংগঠনের কার্যএলাকার মধ্য থেকে বেছে নিন।": "Choose from the organization's operating areas.",
    "শুধু অনুমোদিত সদস্য যোগ করা যাবে।": "Only approved members can be added.",
    "একজন সদস্য একই সময়ে একটি ছোট দলেই থাকতে পারবেন।": "A member can belong to only one small team at a time.",
    "আবেদন পাওয়া যায়নি।": "Request not found.",
    "নির্ধারিত/সম্পন্ন কার্যক্রমের আবেদন পুনরায় যাচাই করা যাবে না।": "A request with an assigned or completed mission cannot be reviewed again.",
    "কারণ বা প্রয়োজনীয় তথ্য লিখুন।": "Enter a reason or the required information.",
    "ট্র্যাকিং কোড মেলেনি।": "Tracking code did not match.",
    "এই আবেদনে এখন অতিরিক্ত তথ্য প্রয়োজন নেই।": "Additional information is not needed for this request right now.",
    "পরিস্থিতির অতিরিক্ত তথ্য লিখুন।": "Enter additional situation details.",
    "আবেদন বা দল পাওয়া যায়নি।": "Request or team not found.",
    "দল নির্ধারণের আগে আবেদন যাচাই করুন।": "Verify the request before assigning a team.",
    "আবেদনের সক্রিয় বা সম্পন্ন কার্যক্রম রয়েছে।": "This request has an active or completed mission.",
    "দলটি এখন এই আবেদনের জন্য উপযুক্ত নয়।": "This team is not currently eligible for this request.",
    "সুপার অ্যাডমিন দল নির্ধারণ করেছেন": "Super admin assigned the team",
    "কার্যক্রম পাওয়া যায়নি।": "Mission not found.",
    "কার্যক্রমে প্রবেশাধিকার নেই।": "You do not have access to this mission.",
    "সমাপ্ত কার্যক্রম পরিবর্তন করা যাবে না।": "A closed mission cannot be changed.",
    "শুধু নির্ধারিত দলের নেতা এই কাজ করতে পারেন।": "Only the assigned team leader can perform this action.",
    "এই অবস্থা পরিবর্তন অনুমোদিত নয়।": "This status change is not allowed.",
    "নোট লিখুন।": "Enter a note.",
    "সরবরাহকারীর তথ্য দিন।": "Provide supplier details.",
    "সরবরাহকারী পাওয়া যায়নি।": "Supplier not found.",
    "নাম ও সঠিক পরিমাণ দিন।": "Enter a name and a valid quantity.",
    "পুরোনো ডেমো তথ্যের সংস্করণ বদলেছে; নতুন নমুনা তথ্য ব্যবহার হচ্ছে।": "The stored demo data version has changed; new sample data is being used.",
    "সংরক্ষিত ডেমো তথ্য পড়া যায়নি; এই সেশনে নতুন নমুনা তথ্য ব্যবহার হচ্ছে।": "Stored demo data could not be read; this session is using new sample data.",
    "ব্রাউজারে তথ্য সংরক্ষণ করা যায়নি। রিফ্রেশে এই সেশনের পরিবর্তন হারাতে পারে।": "Data could not be saved in this browser. Changes may be lost on refresh.",
    "আবার চেষ্টা করুন।": "Please try again.",
    আবশ্যক: "Required",
    "(ঐচ্ছিক)": "(optional)",
    "খুঁজুন...": "Search...",
    খুঁজুন: "Search",
    "কিছু পাওয়া যায়নি": "No results found",
    "লোড হচ্ছে...": "Loading...",
    "বন্ধ করুন": "Close",
    পৃষ্ঠা: "Page",
    আগের: "Previous",
    পরের: "Next",
    "অনুমোদিত সদস্য (অন্তত একজন)": "Approved members (at least one)",
    "ভাষা নির্বাচন করুন": "Select language",
    আবেদন: "Request",
    "স্বাগতম,": "Welcome,",
    "ডেমো সূচি": "demo index",
    সদর: "Sadar",
    "গুদাম:": "Warehouse:",
    "জনসমক্ষে নাম/ফোন দেখানো হয় না।": "Names and phone numbers are not shown publicly.",
    "রেফারেন্স ও কোড লিখে রাখুন।": "Keep your reference and tracking code.",
    "গোপনীয়তা নীতি": "Privacy policy",
    "একটি অনুমোদিত সদস্যপদ বা অপেক্ষমাণ অনুরোধ থাকলে নতুন অনুরোধ বন্ধ থাকে।": "New requests are blocked while you have an approved membership or a pending request.",
    "-এর তথ্য যাচাইয়ের অপেক্ষায় রয়েছে।": "'s information is awaiting review.",
    "দায়িত্বশীল প্রশাসকের নাম": "Responsible administrator's name",
    "এই নামে সংগঠনের প্রশাসক অ্যাকাউন্ট তৈরি হবে।": "An organization administrator account will be created under this name.",
    লগইন: "Log in",
    "ডেভেলপার নিয়ন্ত্রণ": "Developer controls",
    "অ্যাকাউন্ট বদলান": "Switch account",
    "পৃষ্ঠা সূচি": "Page index",
    "হ্যাঁ, তথ্য রিসেট করুন": "Yes, reset data",
    "তথ্য রিসেট করুন": "Reset data",
    "একটি অ্যাকাউন্ট বেছে নিন": "Choose an account",
    অ্যাকাউন্ট: "Account",
    "প্রবেশ করুন": "Continue",
    "রেফারেন্স ও ট্র্যাকিং কোড দিয়ে অগ্রগতি দেখুন": "Use your reference and tracking code to view progress",
    "সঠিক অ্যাকাউন্ট বেছে নিন। অন্য সংগঠন বা দলের সীমাবদ্ধ কার্যক্রম দেখা যায় না।": "Choose the correct account. Restricted work belonging to other organizations or teams cannot be viewed.",
    "তথ্য ও গোপনীয়তা": "Data and privacy",
    "ফর্ম, প্রোফাইল ও কার্যক্রমের তথ্য এই ব্রাউজারে সংরক্ষিত থাকে।": "Form, profile and mission information is stored in this browser.",
    "মানচিত্র, আবেদনের সারসংক্ষেপ ও ট্র্যাকিংয়ে নাম ও ফোন নম্বর দেখানো হয় না। ডেভেলপার নিয়ন্ত্রণ থেকে সংরক্ষিত তথ্য রিসেট করতে পারবেন।": "Names and phone numbers are not shown on the map, request summaries or tracking. You can reset stored information using Developer controls.",
    "বাংলাদেশের মানচিত্র": "Map of Bangladesh",
    "মানচিত্রের অবস্থা পরিবর্তন": "Change map state",
    "মানচিত্রের অবস্থা": "Map state",
    "যোগাযোগ:": "Contact:",
    যোগাযোগ: "Contact",
    "সংরক্ষিত তথ্যের সংস্করণ বদলেছে; প্রাথমিক তথ্য ব্যবহার হচ্ছে।": "The stored data version has changed; initial data is being used.",
    "সংরক্ষিত তথ্য পড়া যায়নি; এই সেশনে প্রাথমিক তথ্য ব্যবহার হচ্ছে।": "Stored data could not be read; this session is using initial data.",
    "প্রোফাইল ছবি": "Profile image",
    "সংগঠনের ছবি": "Organization image",
    "প্রোফাইল ছবি বেছে নিন": "Choose a profile image",
    "সংগঠনের ছবি বেছে নিন": "Choose an organization image",
    "ছবি যুক্ত করুন": "Add image",
    "ছবি পরিবর্তন করুন": "Change image",
    "ছবি সরান": "Remove image",
    "ছবি প্রস্তুত হচ্ছে...": "Preparing image...",
    "JPG, PNG অথবা WebP · সর্বোচ্চ ৫ মেগাবাইট": "JPG, PNG or WebP · up to 5 MB",
    "JPG, PNG অথবা WebP ছবি বেছে নিন।": "Choose a JPG, PNG or WebP image.",
    "ছবির আকার ৫ মেগাবাইটের মধ্যে হতে হবে।": "The image must be no larger than 5 MB.",
    "ছবিটি পড়া যায়নি। অন্য একটি ছবি বেছে নিন।": "This image could not be read. Choose another image.",
    "ছবিটি প্রস্তুত করা যায়নি। আবার চেষ্টা করুন।": "The image could not be prepared. Please try again.",
    "ছবির আকার কমিয়ে আবার চেষ্টা করুন।": "Reduce the image size and try again."
  };

  // locale.js
  var LANGUAGE_KEY = "shara-language";
  var messages = en_default;
  var listeners =  new Set();
  function readLanguage() {
    try {
      return localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "bn";
    } catch {
      return "bn";
    }
  }
  var language = readLanguage();
  var getLanguage = () => language;
  var subscribeLanguage = (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  function publish(next) {
    language = next;
    if (typeof document !== "undefined")
      document.documentElement.lang = next;
    listeners.forEach((listener) => listener());
  }
  function setLanguage(next) {
    try {
      localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
    }
    publish(next);
  }
  if (typeof window !== "undefined") {
    document.documentElement.lang = language;
    window.addEventListener("storage", (event) => {
      if (event.key === LANGUAGE_KEY || event.key === null)
        publish(readLanguage());
    });
  }
  var escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var phrases = new RegExp(`(?<![\\u0980-\\u09ff])(?:${Object.keys(messages).sort((a, b) => b.length - a.length).map(escapeRegExp).join("|")})(?![\\u0980-\\u09ff])`, "g");
  var latinDigits = (value) => value.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));
  function translate(value, target) {
    if (target === "bn" || typeof value !== "string" || !/[\u0980-\u09ff]/.test(value))
      return value;
    const normalized = value.replace(/\s+/g, " ").trim();
    const result = messages[normalized];
    if (result === void 0) {
      return latinDigits(value).replace(phrases, (match) => messages[match]);
    }
    return (value.match(/^\s*/)?.[0] ?? "") + latinDigits(result) + (value.match(/\s*$/)?.[0] ?? "");
  }
  function matchesSearch(value, query) {
    const needle = query.trim().toLocaleLowerCase();
    return value.toLocaleLowerCase().includes(needle) || translate(value, "en").toLocaleLowerCase().includes(needle);
  }

  // i18n.js
  function languageContext() {
    const language2 = subscribeState(subscribeLanguage, getLanguage, () => "bn");
    return {
      language: language2,
      setLanguage,
      tr: (value) => translate(value, language2)
    };
  }

  // icons.js
  function CircleCheck({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#circle-check" }), children);
  }
  function Loader2({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#loader2" }), children);
  }
  function X({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#x" }), children);
  }
  function Minus({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#minus" }), children);
  }
  function Plus({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#plus" }), children);
  }
  function RotateCcw({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#rotate-ccw" }), children);
  }
  function Search({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#search" }), children);
  }
  function ShieldCheck({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#shield-check" }), children);
  }
  function MapPin({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#map-pin" }), children);
  }
  function Users({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#users" }), children);
  }
  function ArrowRight({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#arrow-right" }), children);
  }
  function ClipboardCheck({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#clipboard-check" }), children);
  }
  function FilePenLine({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#file-pen-line" }), children);
  }
  function HandHeart({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#hand-heart" }), children);
  }
  function Truck({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#truck" }), children);
  }
  function UserX({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#user-x" }), children);
  }
  function Building2({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#building2" }), children);
  }
  function ClipboardList({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#clipboard-list" }), children);
  }
  function Flag({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#flag" }), children);
  }
  function HeartHandshake({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#heart-handshake" }), children);
  }
  function LayoutDashboard({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#layout-dashboard" }), children);
  }
  function Languages({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#languages" }), children);
  }
  function Menu({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#menu" }), children);
  }
  function Package({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#package" }), children);
  }
  function AlertTriangle({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#alert-triangle" }), children);
  }
  function Info({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#info" }), children);
  }

  // data.js
  var bn = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
  var PLACES = [
    {
      id: "kurigram-sadar",
      upazila: "কুড়িগ্রাম সদর",
      district: "কুড়িগ্রাম",
      lon: 89.65,
      lat: 25.8,
      requests: 14,
      flooded: true,
      categories: ["খাদ্য", "বিশুদ্ধ পানি", "উদ্ধার"],
      status: { pending: 4, verifying: 3, ongoing: 5, done: 2 }
    },
    {
      id: "gaibandha-sadar",
      upazila: "গাইবান্ধা সদর",
      district: "গাইবান্ধা",
      lon: 89.54,
      lat: 25.33,
      requests: 9,
      flooded: true,
      categories: ["খাদ্য", "ওষুধ"],
      status: { pending: 2, verifying: 2, ongoing: 3, done: 2 }
    },
    {
      id: "sirajganj-chowhali",
      upazila: "চৌহালী",
      district: "সিরাজগঞ্জ",
      lon: 89.6,
      lat: 24.4,
      requests: 6,
      flooded: false,
      categories: ["আশ্রয়", "খাদ্য"],
      status: { pending: 3, verifying: 2, ongoing: 1, done: 0 }
    },
    {
      id: "sunamganj-sadar",
      upazila: "সুনামগঞ্জ সদর",
      district: "সুনামগঞ্জ",
      lon: 91.4,
      lat: 25.05,
      requests: 21,
      flooded: true,
      categories: ["উদ্ধার", "খাদ্য", "বিশুদ্ধ পানি", "ওষুধ"],
      status: { pending: 6, verifying: 5, ongoing: 7, done: 3 }
    },
    {
      id: "sylhet-companiganj",
      upazila: "কোম্পানীগঞ্জ",
      district: "সিলেট",
      lon: 91.9,
      lat: 25,
      requests: 11,
      flooded: true,
      categories: ["উদ্ধার", "খাদ্য"],
      status: { pending: 3, verifying: 3, ongoing: 4, done: 1 }
    },
    {
      id: "netrokona-kalmakanda",
      upazila: "কলমাকান্দা",
      district: "নেত্রকোনা",
      lon: 90.85,
      lat: 25,
      requests: 5,
      flooded: false,
      categories: ["খাদ্য"],
      status: { pending: 2, verifying: 1, ongoing: 2, done: 0 }
    },
    {
      id: "jamalpur-islampur",
      upazila: "ইসলামপুর",
      district: "জামালপুর",
      lon: 89.85,
      lat: 25.1,
      requests: 7,
      flooded: true,
      categories: ["খাদ্য", "আশ্রয়"],
      status: { pending: 2, verifying: 1, ongoing: 3, done: 1 }
    },
    {
      id: "feni-chhagalnaiya",
      upazila: "ছাগলনাইয়া",
      district: "ফেনী",
      lon: 91.5,
      lat: 23.05,
      requests: 8,
      flooded: true,
      categories: ["উদ্ধার", "আশ্রয়", "ওষুধ"],
      status: { pending: 1, verifying: 2, ongoing: 3, done: 2 }
    },
    {
      id: "noakhali-companiganj",
      upazila: "কোম্পানীগঞ্জ (নোয়াখালী)",
      district: "নোয়াখালী",
      lon: 91.1,
      lat: 22.7,
      requests: 4,
      flooded: false,
      categories: ["খাদ্য", "বিশুদ্ধ পানি"],
      status: { pending: 1, verifying: 1, ongoing: 1, done: 1 }
    },
    {
      id: "khulna-koyra",
      upazila: "কয়রা",
      district: "খুলনা",
      lon: 89.3,
      lat: 22.35,
      requests: 3,
      flooded: false,
      categories: ["বিশুদ্ধ পানি"],
      status: { pending: 1, verifying: 1, ongoing: 1, done: 0 }
    }
  ];
  var REQUESTS = [
    {
      id: "SH-24-0412",
      type: "direct",
      district: "সুনামগঞ্জ",
      upazila: "সুনামগঞ্জ সদর",
      people: 12,
      aid: ["উদ্ধার", "খাদ্য"],
      time: "৯ অক্টো, সকাল ৮:১২",
      verify: "pending",
      priority: "high",
      mission: "pending",
      note: "বাড়ির নিচতলা ডুবে গেছে। শিশু ও বয়স্ক মানুষ ছাদে আটকে আছেন।",
      phone: "০১৭১১-০০০০১২",
      reporter: "আবেদনকারী নিজেই"
    },
    {
      id: "SH-24-0411",
      type: "proxy",
      district: "কুড়িগ্রাম",
      upazila: "কুড়িগ্রাম সদর",
      people: 5,
      aid: ["বিশুদ্ধ পানি", "ওষুধ"],
      time: "৯ অক্টো, সকাল ৭:৪০",
      verify: "verified",
      priority: "high",
      team: "তিস্তা উদ্ধার দল",
      mission: "ongoing",
      note: "আত্মীয়ের পরিবার বাঁধের ওপর আশ্রয় নিয়েছে। পানীয় জল শেষ।",
      phone: "০১৮১২-০০০০৪৫",
      reporter: "সাদিয়া ইসলাম (প্রতিবেশী)"
    },
    {
      id: "SH-24-0409",
      type: "direct",
      district: "ফেনী",
      upazila: "ছাগলনাইয়া",
      people: 8,
      aid: ["আশ্রয়", "খাদ্য"],
      time: "৮ অক্টো, রাত ১১:২০",
      verify: "verified",
      priority: "medium",
      team: "ফেনী সবুজ দল",
      mission: "assigned",
      note: "ঘর পানিতে তলিয়ে গেছে, স্কুলে আশ্রয় প্রয়োজন।",
      phone: "০১৯১৫-০০০০৭৭",
      reporter: "আবেদনকারী নিজেই"
    },
    {
      id: "SH-24-0405",
      type: "direct",
      district: "গাইবান্ধা",
      upazila: "গাইবান্ধা সদর",
      people: 3,
      aid: ["ওষুধ"],
      time: "৮ অক্টো, রাত ৯:০৫",
      verify: "pending",
      priority: "medium",
      mission: "pending",
      note: "ডায়াবেটিসের রোগীর জন্য জরুরি ওষুধ প্রয়োজন।",
      phone: "০১৬২২-০০০০৩৩",
      reporter: "আবেদনকারী নিজেই"
    },
    {
      id: "SH-24-0398",
      type: "proxy",
      district: "সিরাজগঞ্জ",
      upazila: "চৌহালী",
      people: 20,
      aid: ["খাদ্য", "আশ্রয়"],
      time: "৮ অক্টো, বিকাল ৪:৩০",
      verify: "verified",
      priority: "low",
      team: "যমুনা তীর স্বেচ্ছাসেবক",
      mission: "done",
      note: "চরের ২০টি পরিবারের শুকনো খাবার প্রয়োজন ছিল।",
      phone: "০১৭৭৭-০০০০৯৯",
      reporter: "রাকিব হাসান (ইউপি সদস্যের সহকারী)"
    },
    {
      id: "SH-24-0391",
      type: "direct",
      district: "নেত্রকোনা",
      upazila: "কলমাকান্দা",
      people: 6,
      aid: ["খাদ্য"],
      time: "৮ অক্টো, দুপুর ১২:১০",
      verify: "rejected",
      priority: "low",
      mission: "pending",
      note: "তথ্য অসম্পূর্ণ, যোগাযোগ করা যায়নি।",
      phone: "০১৫১৫-০০০০২২",
      reporter: "আবেদনকারী নিজেই"
    }
  ];
  var SUPPLIERS = [
    {
      id: "s1",
      name: "রহমান ট্রেডার্স",
      cat: "খাদ্যসামগ্রী",
      place: "সিলেট, কোম্পানীগঞ্জ",
      contact: "০১৭১২-০০০১০১",
      verified: true,
      avail: "সরবরাহে প্রস্তুত",
      res: [
        {
          name: "চাল (৫ কেজি প্যাকেট)",
          cat: "খাদ্য",
          qty: 1200,
          status: "মজুদ আছে",
          note: "গুদাম: সিলেট সদর"
        },
        {
          name: "শুকনো খাবারের প্যাকেট",
          cat: "খাদ্য",
          qty: 340,
          status: "মজুদ আছে",
          note: "চিড়া, গুড়, বিস্কুট"
        }
      ]
    },
    {
      id: "s2",
      name: "নদীপথ বোট সার্ভিস",
      cat: "পরিবহন",
      place: "সুনামগঞ্জ, সদর",
      contact: "০১৮১৯-০০০২০২",
      verified: true,
      avail: "আংশিক প্রস্তুত",
      res: [
        {
          name: "ইঞ্জিনচালিত নৌকা",
          cat: "উদ্ধার",
          qty: 6,
          status: "সীমিত",
          note: "২টি মেরামতাধীন"
        }
      ]
    },
    {
      id: "s3",
      name: "আরোগ্য মেডিক্যাল সাপ্লাই",
      cat: "চিকিৎসা",
      place: "গাইবান্ধা, সদর",
      contact: "০১৬১১-০০০৩০৩",
      verified: false,
      avail: "যাচাই চলছে",
      res: [
        {
          name: "ওরস্যালাইন",
          cat: "ওষুধ",
          qty: 2500,
          status: "মজুদ আছে",
          note: "মেয়াদ ২০২৭ পর্যন্ত"
        },
        {
          name: "প্রাথমিক চিকিৎসা বক্স",
          cat: "ওষুধ",
          qty: 0,
          status: "মজুদ শেষ",
          note: "নতুন চালান অপেক্ষমাণ"
        }
      ]
    }
  ];
  var statusLabel = {
    pending: "অপেক্ষমাণ",
    verified: "যাচাইকৃত",
    rejected: "বাতিল",
    assigned: "দল নির্ধারিত",
    ongoing: "কার্যক্রম চলমান",
    done: "সম্পন্ন",
    high: "জরুরি",
    medium: "মাঝারি",
    low: "সাধারণ"
  };

  // profile-image.js
  var MAX_PROFILE_IMAGE_LENGTH = 18e4;
  var MAX_FILE_BYTES = 5 * 1024 * 1024;
  function isProfileImage(value) {
    return value === void 0 || value === "" || typeof value === "string" && value.length <= MAX_PROFILE_IMAGE_LENGTH && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
  }

  // model.js
  var VERSION = 1;
  var SKILLS = [
    "নৌকা চালনা",
    "প্রাথমিক চিকিৎসা",
    "রান্না ও খাদ্য বিতরণ",
    "সাঁতার",
    "যোগাযোগ সমন্বয়",
    "যানবাহন চালনা"
  ];
  var ORGANIZATION_TYPES = [
    "বেসরকারি উন্নয়ন সংস্থা (এনজিও)",
    "অলাভজনক / দাতব্য সংস্থা",
    "স্থানীয় কমিউনিটি সংগঠন",
    "সরকারি প্রতিষ্ঠান",
    "শিক্ষাপ্রতিষ্ঠানভিত্তিক সংগঠন"
  ];
  var labels = {
    pending: "যাচাই অপেক্ষমাণ",
    verified: "যাচাইকৃত",
    rejected: "প্রত্যাখ্যাত",
    clarification: "তথ্য স্পষ্টকরণ প্রয়োজন",
    approved: "সদস্যপদ অনুমোদিত",
    assigned: "নেতার স্বীকৃতি অপেক্ষমাণ",
    acknowledged: "দল স্বীকৃতি দিয়েছে",
    ongoing: "কার্যক্রম চলমান",
    problem: "সমস্যা জানানো হয়েছে",
    done: "সহায়তা সম্পন্ন",
    cancelled: "কার্যক্রম বাতিল",
    failed: "কার্যক্রম ব্যর্থ",
    ready: "প্রস্তুত",
    limited: "সীমিত প্রাপ্যতা",
    unavailable: "অনুপলব্ধ",
    available: "এখনই প্রস্তুত"
  };
  var active = (m) => !["done", "cancelled", "failed"].includes(m.status);
  function missionStage(m) {
    if (["assigned", "acknowledged", "ongoing", "done"].includes(m.status)) {
      return m.status;
    }
    const previous = [...m.history].reverse().find((entry) => ["assigned", "acknowledged", "ongoing", "done"].includes(entry.status));
    return previous?.status ?? "assigned";
  }
  var account = (s) => s.accounts.find((a) => a.id === s.sessionId);
  function canViewMission(s, m) {
    const a = account(s), t = s.teams.find((t2) => t2.id === m.teamId);
    return !!a && !!t && (a.role === "admin" || a.role === "org" && a.orgId === t.orgId || a.role === "volunteer" && t.memberIds.includes(a.volunteerId ?? ""));
  }
  function eligibility(s, t, r) {
    const reasons = [];
    if (s.organizations.find((o) => o.id === t.orgId)?.verification !== "verified")
      reasons.push("সংগঠন যাচাইকৃত নয়");
    if (!t.areas.includes(r.district) && !t.areas.includes(r.upazila))
      reasons.push("কার্যএলাকা মেলে না");
    if (t.availability !== "ready")
      reasons.push("দল প্রস্তুত নয়");
    if (s.missions.some((m) => m.teamId === t.id && active(m)))
      reasons.push("অন্য সক্রিয় কার্যক্রম রয়েছে");
    if (!t.leaderId || !t.memberIds.includes(t.leaderId))
      reasons.push("দলের নেতা নেই");
    if (t.memberIds.some((id) => !s.memberships.some((m) => m.volunteerId === id && m.orgId === t.orgId && m.status === "approved")))
      reasons.push("অনুমোদিত সদস্য প্রয়োজন");
    if (!r.aid.every((need) => t.capabilities.includes(need)))
      reasons.push("প্রয়োজনীয় সক্ষমতা অসম্পূর্ণ");
    return reasons;
  }
  function seed() {
    const createdAt = "2026-07-01T08:00:00.000Z";
    const volunteers = [
      ["v1", "ফারজানা আক্তার", "কুড়িগ্রাম", "কুড়িগ্রাম সদর"],
      ["v2", "নাসির উদ্দিন", "কুড়িগ্রাম", "উলিপুর"],
      ["v3", "রাফিয়া সুলতানা", "সুনামগঞ্জ", "সুনামগঞ্জ সদর"],
      ["v4", "কামরুল হাসান", "সুনামগঞ্জ", "ছাতক"],
      ["v5", "আয়েশা সিদ্দিকা", "সুনামগঞ্জ", "দোয়ারাবাজার"],
      ["v6", "মাহমুদা খাতুন", "ফেনী", "ছাগলনাইয়া"],
      ["v7", "রাশেদুল ইসলাম", "সিরাজগঞ্জ", "চৌহালী"],
      ["v8", "সুমাইয়া আক্তার", "সুনামগঞ্জ", "সুনামগঞ্জ সদর"]
    ].map(([id, name, district, upazila]) => ({
      id,
      name,
      district,
      upazila,
      phone: "০১৭০০-০০০০০০",
      areas: [upazila],
      skills: [SKILLS[0], SKILLS[1]],
      availability: "available",
      vehicleAccess: false,
      swimmingCapability: true
    }));
    const organizations = [
      {
        id: "o1",
        adminId: "a-org1",
        name: "সবুজ বাংলা ফাউন্ডেশন",
        areas: ["সুনামগঞ্জ", "সিলেট", "কুড়িগ্রাম", "ফেনী", "সিরাজগঞ্জ"],
        verification: "verified"
      },
      {
        id: "o2",
        adminId: "a-org2",
        name: "তিস্তা মানবিক সহায়তা কেন্দ্র",
        areas: ["কুড়িগ্রাম", "রংপুর"],
        verification: "pending"
      }
    ].map((o) => ({
      description: "উদ্ধার, খাদ্য সহায়তা ও পুনর্বাসনে স্থানীয় স্বেচ্ছাসেবকদের সঙ্গে কাজ করে।",
      organizationType: ORGANIZATION_TYPES[1],
      contactEmail: "demo@example.org",
      contactPhone: "০১৭০০-০০০০০০",
      locations: ["সুনামগঞ্জ সদর, সুনামগঞ্জ"],
      reason: "",
      createdAt,
      ...o
    }));
    const teams = [
      {
        id: "t1",
        orgId: "o1",
        name: "তিস্তা উদ্ধার দল",
        areas: ["কুড়িগ্রাম"],
        memberIds: ["v1", "v2"],
        leaderId: "v1",
        availability: "ready",
        capabilities: ["খাদ্য", "বিশুদ্ধ পানি", "ওষুধ", "উদ্ধার", "আশ্রয়"]
      },
      {
        id: "t2",
        orgId: "o1",
        name: "সুরমা নৌ-উদ্ধার",
        areas: ["সুনামগঞ্জ", "সিলেট"],
        memberIds: ["v4", "v5"],
        leaderId: "v4",
        availability: "ready",
        capabilities: ["উদ্ধার", "খাদ্য", "বিশুদ্ধ পানি"]
      },
      {
        id: "t3",
        orgId: "o1",
        name: "ফেনী সবুজ দল",
        areas: ["ফেনী"],
        memberIds: ["v6"],
        leaderId: "v6",
        availability: "ready",
        capabilities: ["আশ্রয়", "খাদ্য"]
      },
      {
        id: "t4",
        orgId: "o1",
        name: "যমুনা তীর স্বেচ্ছাসেবক",
        areas: ["সিরাজগঞ্জ"],
        memberIds: ["v7"],
        leaderId: "v7",
        availability: "ready",
        capabilities: ["আশ্রয়", "খাদ্য"]
      }
    ];
    return {
      version: VERSION,
      sessionId: null,
      volunteers,
      organizations,
      teams,
      accounts: [
        ...volunteers.map((v) => ({
          id: `a-${v.id}`,
          name: v.name,
          role: "volunteer",
          volunteerId: v.id
        })),
        { id: "a-org1", name: "তানভীর আহমেদ", role: "org", orgId: "o1" },
        { id: "a-org2", name: "নুসরাত জাহান", role: "org", orgId: "o2" },
        { id: "a-admin", name: "প্ল্যাটফর্ম প্রশাসক", role: "admin" }
      ],
      memberships: volunteers.map((v) => ({
        id: `mb-${v.id}`,
        volunteerId: v.id,
        orgId: "o1",
        status: v.id === "v3" ? "pending" : "approved",
        reason: "",
        updatedAt: createdAt
      })),
      requests: REQUESTS.map((r, i) => ({
        id: r.id,
        victimName: "নমুনা ব্যক্তি",
        phone: "০১৭০০-০০০০০০",
        reporter: "ডেমো আবেদনকারী",
        reporterPhone: "",
        relation: "",
        district: r.district,
        upazila: r.upazila,
        people: r.people,
        aid: r.aid,
        note: r.note,
        isProxy: r.type === "proxy",
        risks: i === 0 ? ["আটকে আছেন", "শিশু ঝুঁকিতে", "বয়স্ক ব্যক্তি"] : [],
        priority: r.priority,
        verification: r.verify,
        reviewNote: "",
        trackingCode: `DEMO-${412 - i}`,
        createdAt,
        updatedAt: createdAt
      })),
      missions: REQUESTS.filter((r) => r.team).map((r) => ({
        id: `M-${r.id.slice(-4)}`,
        requestId: r.id,
        teamId: teams.find((t) => t.name === r.team).id,
        status: r.mission,
        createdAt,
        updatedAt: createdAt,
        history: [
          {
            at: createdAt,
            text: "ডেমো: যাচাইয়ের পর দল নির্ধারিত",
            status: r.mission
          }
        ]
      })),
      suppliers: SUPPLIERS.map((s) => ({
        ...s,
        res: s.res.map((r, i) => ({ ...r, id: `${s.id}-r${i}` }))
      }))
    };
  }
  function transition(state2, action, now = ( new Date()).toISOString()) {
    const s = structuredClone(state2), a = account(s);
    const assert = (ok, message) => {
      if (!ok)
        throw new Error(message);
    };
    const admin = () => assert(a?.role === "admin", "শুধু সুপার অ্যাডমিন এই কাজ করতে পারেন।");
    const owner = (orgId, operational = true) => {
      const o = s.organizations.find((o2) => o2.id === orgId);
      assert(a?.role === "org" && a.orgId === orgId, "এই সংগঠনে প্রবেশাধিকার নেই।");
      assert(!operational || o?.verification === "verified", "সংগঠনের যাচাই সম্পন্ন হওয়া প্রয়োজন।");
    };
    switch (action.type) {
      case "login":
        assert(!action.id || s.accounts.some((x) => x.id === action.id), "অ্যাকাউন্ট পাওয়া যায়নি।");
        s.sessionId = action.id;
        break;
      case "request":
        assert(!s.requests.some((r) => r.id === action.record.id), "আবেদনটি ইতিমধ্যে জমা হয়েছে।");
        assert(action.record.people > 0 && action.record.aid.length > 0, "আবেদনের তথ্য অসম্পূর্ণ।");
        assert(!s.requests.some((r) => r.trackingCode === action.record.trackingCode), "ট্র্যাকিং কোডটি ব্যবহৃত হয়েছে। আবার চেষ্টা করুন।");
        s.requests.push({ ...action.record, verification: "pending" });
        break;
      case "registerVolunteer":
        assert(isProfileImage(action.volunteer.profileImage), "ছবিটি প্রস্তুত করা যায়নি। আবার চেষ্টা করুন।");
        assert(!s.volunteers.some((v) => v.id === action.volunteer.id), "অ্যাকাউন্টটি ইতিমধ্যে তৈরি হয়েছে।");
        s.volunteers.push(action.volunteer);
        s.accounts.push(action.account);
        s.sessionId = action.account.id;
        if (action.orgId) {
          assert(s.organizations.some((o) => o.id === action.orgId && o.verification === "verified"), "যাচাইকৃত সংগঠন বেছে নিন।");
          s.memberships.push({
            id: action.membershipId,
            orgId: action.orgId,
            volunteerId: action.volunteer.id,
            status: "pending",
            reason: "",
            updatedAt: now
          });
        }
        break;
      case "profile":
        assert(a?.role === "volunteer" && a.volunteerId === action.record.id, "নিজের প্রোফাইলই সম্পাদনা করা যাবে।");
        assert(isProfileImage(action.record.profileImage), "ছবিটি প্রস্তুত করা যায়নি। আবার চেষ্টা করুন।");
        s.volunteers = s.volunteers.map((v) => v.id === action.record.id ? action.record : v);
        s.accounts = s.accounts.map((x) => x.id === a.id ? { ...x, name: action.record.name } : x);
        break;
      case "registerOrg":
        assert(isProfileImage(action.record.profileImage), "ছবিটি প্রস্তুত করা যায়নি। আবার চেষ্টা করুন।");
        assert(action.record.adminId === action.account.id && action.account.orgId === action.record.id, "প্রশাসক সম্পর্ক সঠিক নয়।");
        assert(!s.organizations.some((o) => o.name.trim() === action.record.name.trim()), "এই নামে সংগঠন ইতিমধ্যে রয়েছে।");
        s.organizations.push({ ...action.record, verification: "pending" });
        s.accounts.push(action.account);
        s.sessionId = action.account.id;
        break;
      case "orgProfile":
        owner(action.record.id, false);
        assert(isProfileImage(action.record.profileImage), "ছবিটি প্রস্তুত করা যায়নি। আবার চেষ্টা করুন।");
        assert(s.teams.filter((t) => t.orgId === action.record.id).every((t) => t.areas.every((area) => action.record.areas.includes(area))), "এই জেলায় ছোট দলের কার্যএলাকা রয়েছে। আগে দলটির কার্যএলাকা পরিবর্তন করুন।");
        s.organizations = s.organizations.map((o) => o.id === action.record.id ? {
          ...action.record,
          adminId: o.adminId,
          createdAt: o.createdAt,
          verification: o.verification,
          reason: o.reason
        } : o);
        break;
      case "verifyOrg": {
        admin();
        const o = s.organizations.find((o2) => o2.id === action.id);
        assert(o, "সংগঠন পাওয়া যায়নি।");
        assert(action.status !== "rejected" || action.reason.trim(), "প্রত্যাখ্যানের কারণ লিখুন।");
        assert(!s.missions.some((m) => active(m) && s.teams.find((t) => t.id === m.teamId)?.orgId === o.id), "সক্রিয় কার্যক্রম থাকলে যাচাই-অবস্থা পরিবর্তন করা যাবে না।");
        o.verification = action.status;
        o.reason = action.reason;
        break;
      }
      case "join": {
        assert(a?.role === "volunteer" && a.volunteerId === action.record.volunteerId, "নিজের সদস্যপদের অনুরোধ পাঠান।");
        assert(s.organizations.some((o) => o.id === action.record.orgId && o.verification === "verified"), "সংগঠন এখনো যাচাইকৃত নয়।");
        assert(!s.memberships.some((m) => m.volunteerId === a.volunteerId && ["approved", "pending"].includes(m.status)), "সদস্যপদ বা অপেক্ষমাণ অনুরোধ ইতিমধ্যে রয়েছে।");
        s.memberships.push({
          ...action.record,
          status: "pending",
          reason: "",
          updatedAt: now
        });
        break;
      }
      case "membership": {
        const m = s.memberships.find((m2) => m2.id === action.id);
        assert(m, "অনুরোধ পাওয়া যায়নি।");
        owner(m.orgId);
        assert(action.status !== "rejected" || action.reason.trim(), "কারণ লিখুন।");
        assert(!s.teams.some((t) => t.memberIds.includes(m.volunteerId)), "আগে সদস্যকে দল থেকে সরান; সক্রিয় কার্যক্রমে দল পরিবর্তন করা যাবে না।");
        assert(m.status === "pending" || m.status === "approved", "এই অনুরোধ আর সক্রিয় নয়।");
        if (action.status === "approved")
          assert(!s.memberships.some((x) => x.id !== m.id && x.volunteerId === m.volunteerId && x.status === "approved"), "অন্য সংগঠনে সদস্যপদ রয়েছে।");
        m.status = action.status;
        m.reason = action.reason;
        m.updatedAt = now;
        break;
      }
      case "team": {
        const t = action.record;
        owner(t.orgId);
        const old = s.teams.find((x) => x.id === t.id);
        assert(!old || old.orgId === t.orgId, "দলের মালিকানা বদলানো যাবে না।");
        assert(!s.missions.some((m) => m.teamId === t.id && active(m)), "সক্রিয় কার্যক্রমের সময় দল সম্পাদনা বন্ধ।");
        assert(t.name.trim() && t.areas.length && t.memberIds.length && t.capabilities.length, "দলের সব প্রয়োজনীয় তথ্য দিন।");
        assert(t.memberIds.includes(t.leaderId), "নেতা দলের সদস্যদের মধ্য থেকে বেছে নিন।");
        assert(t.areas.every((area) => s.organizations.find((o) => o.id === t.orgId)?.areas.includes(area)), "সংগঠনের কার্যএলাকার মধ্য থেকে বেছে নিন।");
        assert(t.memberIds.every((id) => s.memberships.some((m) => m.volunteerId === id && m.orgId === t.orgId && m.status === "approved")), "শুধু অনুমোদিত সদস্য যোগ করা যাবে।");
        assert(!s.teams.some((x) => x.id !== t.id && x.memberIds.some((id) => t.memberIds.includes(id))), "একজন সদস্য একই সময়ে একটি ছোট দলেই থাকতে পারবেন।");
        s.teams = old ? s.teams.map((x) => x.id === t.id ? t : x) : [...s.teams, t];
        break;
      }
      case "review": {
        admin();
        const r = s.requests.find((r2) => r2.id === action.id);
        assert(r, "আবেদন পাওয়া যায়নি।");
        assert(!s.missions.some((m) => m.requestId === r.id && (active(m) || m.status === "done")), "নির্ধারিত/সম্পন্ন কার্যক্রমের আবেদন পুনরায় যাচাই করা যাবে না।");
        assert(!["rejected", "clarification"].includes(action.status) || action.reason.trim(), "কারণ বা প্রয়োজনীয় তথ্য লিখুন।");
        r.verification = action.status;
        r.reviewNote = action.reason;
        r.updatedAt = now;
        break;
      }
      case "clarify": {
        const r = s.requests.find((request) => request.id === action.id);
        assert(r && r.trackingCode === action.code, "ট্র্যাকিং কোড মেলেনি।");
        assert(r.verification === "clarification", "এই আবেদনে এখন অতিরিক্ত তথ্য প্রয়োজন নেই।");
        assert(action.note.trim(), "পরিস্থিতির অতিরিক্ত তথ্য লিখুন।");
        r.note = `${r.note}
অতিরিক্ত তথ্য: ${action.note.trim()}`;
        r.verification = "pending";
        r.updatedAt = now;
        break;
      }
      case "dispatch": {
        admin();
        const r = s.requests.find((r2) => r2.id === action.requestId), t = s.teams.find((t2) => t2.id === action.teamId);
        assert(r && t, "আবেদন বা দল পাওয়া যায়নি।");
        assert(r.verification === "verified", "দল নির্ধারণের আগে আবেদন যাচাই করুন।");
        assert(!s.missions.some((m) => m.requestId === r.id && (active(m) || m.status === "done")), "আবেদনের সক্রিয় বা সম্পন্ন কার্যক্রম রয়েছে।");
        assert(!eligibility(s, t, r).length, "দলটি এখন এই আবেদনের জন্য উপযুক্ত নয়।");
        s.missions.push({
          id: action.id,
          requestId: r.id,
          teamId: t.id,
          status: "assigned",
          createdAt: now,
          updatedAt: now,
          history: [
            { at: now, text: "সুপার অ্যাডমিন দল নির্ধারণ করেছেন", status: "assigned" }
          ]
        });
        r.updatedAt = now;
        break;
      }
      case "mission": {
        const m = s.missions.find((m2) => m2.id === action.id);
        assert(m, "কার্যক্রম পাওয়া যায়নি।");
        const t = s.teams.find((t2) => t2.id === m.teamId);
        assert(canViewMission(s, m), "কার্যক্রমে প্রবেশাধিকার নেই।");
        assert(active(m), "সমাপ্ত কার্যক্রম পরিবর্তন করা যাবে না।");
        if (["cancelled", "failed"].includes(action.status)) {
          admin();
          assert(action.note.trim(), "কারণ লিখুন।");
        } else {
          assert(a?.role === "volunteer" && t.leaderId === a.volunteerId, "শুধু নির্ধারিত দলের নেতা এই কাজ করতে পারেন।");
          const allowed = {
            assigned: ["acknowledged", "problem"],
            acknowledged: ["ongoing", "problem"],
            ongoing: ["ongoing", "done", "problem"],
            problem: [missionStage(m)]
          };
          assert(allowed[m.status]?.includes(action.status), "এই অবস্থা পরিবর্তন অনুমোদিত নয়।");
          assert(!(["done", "problem"].includes(action.status) || m.status === action.status || m.status === "problem") || action.note.trim(), "নোট লিখুন।");
        }
        m.status = action.status;
        m.updatedAt = now;
        m.history.push({
          at: now,
          text: action.note.trim() || labels[action.status],
          status: action.status
        });
        s.requests.find((r) => r.id === m.requestId).updatedAt = now;
        break;
      }
      case "supplier":
        admin();
        assert(action.record.name.trim() && action.record.contact.trim(), "সরবরাহকারীর তথ্য দিন।");
        s.suppliers.push(action.record);
        break;
      case "resource": {
        admin();
        const supplier = s.suppliers.find((x) => x.id === action.supplierId);
        assert(supplier, "সরবরাহকারী পাওয়া যায়নি।");
        assert(action.record.name.trim() && Number.isFinite(action.record.qty) && action.record.qty >= 0, "নাম ও সঠিক পরিমাণ দিন।");
        supplier.res.push(action.record);
        break;
      }
    }
    return s;
  }

  // ui.js
  function Logo({ light = false }) {
    return node(
      "span",
      { className: "shara-047 shara-106 shara-115", __site: "ui-656" },
      node(
        "svg",
        { width: "34", height: "34", viewBox: "0 0 34 34", "aria-hidden": "true", __site: "ui-719" },
        node("rect", { width: "34", height: "34", rx: "9", fill: light ? "#EAF4EE" : "#12372A", __site: "ui-795" }),
        node("path", { d: "M17 7.5c-2.6 3.4-6 6-6 9.6a6 6 0 0 0 12 0c0-3.6-3.4-6.2-6-9.6Z", fill: light ? "#12372A" : "#EAF4EE", __site: "ui-927" }),
        node("path", { d: "M7 24.5c3 0 3-1.6 5.2-1.6s2.8 1.6 4.8 1.6 2.8-1.6 4.8-1.6 2.2 1.6 5.2 1.6", stroke: "#2E6B4F", strokeWidth: "1.8", fill: "none", strokeLinecap: "round", __site: "ui-1076" })
      ),
      node("span", { className: `shara-236 shara-243 shara-251 shara-256 ${light ? "shara-279" : "shara-267"}`, __site: "ui-1309" }, "SHARA")
    );
  }
  var btnBase = "shara-047 shara-106 shara-110 shara-114 shara-142 shara-255 shara-293 shara-312 shara-309 shara-295 shara-259";
  var btnVar = {
    primary: "shara-184 shara-279 shara-302",
    secondary: "shara-195 shara-267 shara-150 shara-165 shara-304",
    danger: "shara-181 shara-279 shara-305",
    ghost: "shara-267 shara-304"
  };
  var btnSize = {
    sm: "shara-068 shara-210 shara-242",
    md: "shara-070 shara-212 shara-247",
    lg: "shara-073 shara-213 shara-241"
  };
  function Button({ variant = "primary", size = "md", to, className = "", children, ...p }) {
    const { tr } = languageContext();
    const cls = `${btnBase} ${btnVar[variant]} ${btnSize[size]} ${className}`;
    if (to)
      return node(Link, { to, className: cls, "aria-label": tr(p["aria-label"]), __site: "ui-2454" }, children);
    return node("button", { type: "button", className: cls, ...p, __site: "ui-2605" }, children);
  }
  var tone = {
    pending: "shara-182 shara-265 shara-163",
    verified: "shara-187 shara-267 shara-160",
    rejected: "shara-190 shara-274 shara-170",
    assigned: "shara-194 shara-278 shara-172",
    ongoing: "shara-185 shara-268 shara-166",
    done: "shara-187 shara-267 shara-160",
    high: "shara-193 shara-276 shara-171",
    medium: "shara-182 shara-265 shara-163",
    low: "shara-190 shara-275 shara-170",
    neutral: "shara-190 shara-275 shara-170"
  };
  function Badge({ s, children, dot = true }) {
    const { tr } = languageContext();
    return node(
      "span",
      { className: `shara-047 shara-106 shara-113 shara-259 shara-144 shara-150 shara-209 shara-214 shara-246 shara-253 ${tone[s] ?? tone.neutral}`, __site: "ui-3466" },
      dot && node("span", { className: "shara-051 shara-144 shara-183", "aria-hidden": "true", __site: "ui-3654" }),
      tr(children ?? labels[s] ?? statusLabel[s] ?? s)
    );
  }
  var inputCls = "shara-071 shara-078 shara-142 shara-150 shara-159 shara-195 shara-211 shara-240 shara-269 shara-296 shara-298 shara-317 shara-318";
  function Alert({ kind = "info", title, children }) {
    const { tr } = languageContext();
    const m = {
      info: ["shara-187 shara-160 shara-267", Info],
      error: ["shara-193 shara-171 shara-277", AlertTriangle],
      success: ["shara-187 shara-160 shara-267", CircleCheck],
      warn: ["shara-182 shara-163 shara-266", AlertTriangle]
    };
    const [c, Icon] = m[kind];
    return node(
      "div",
      { role: kind === "error" ? "alert" : "status", className: `shara-044 shara-116 shara-142 shara-150 shara-202 shara-247 ${c}`, __site: "ui-8772" },
      node(Icon, { size: 20, className: "shara-021 shara-096", __site: "ui-8921" }),
      node(
        "div",
        { __site: "ui-8974" },
        title && node("p", { className: "shara-255", __site: "ui-8997" }, tr(title)),
        children && node("div", { className: title ? "shara-283" : "", __site: "ui-9066" }, children)
      )
    );
  }
  function Spinner({ label = "লোড হচ্ছে..." }) {
    const { tr } = languageContext();
    return node(
      "div",
      { role: "status", className: "shara-044 shara-106 shara-114 shara-270", __site: "ui-9298" },
      node(Loader2, { className: "shara-098", size: 20, __site: "ui-9379" }),
      tr(label)
    );
  }
  function Empty({ icon, title, children, action }) {
    const { tr } = languageContext();
    return node(
      "div",
      { className: "shara-044 shara-102 shara-106 shara-114 shara-148 shara-150 shara-157 shara-159 shara-195 shara-213 shara-221 shara-233", __site: "ui-9659" },
      icon && node("div", { className: "shara-032 shara-045 shara-057 shara-104 shara-144 shara-187 shara-271", __site: "ui-9812" }, icon),
      node("p", { className: "shara-241 shara-255 shara-269", __site: "ui-9954" }, tr(title)),
      children && node("p", { className: "shara-089 shara-270", __site: "ui-10034" }, children),
      action && node("div", { className: "shara-024", __site: "ui-10105" }, action)
    );
  }
  function Dialog({ open, onClose, title, children, footer }) {
    const { tr } = languageContext();
    const ref = retain(null);
    const titleId = uniqueId();
    afterPaint(() => {
      if (!open || !ref.current)
        return;
      const previousFocus = document.activeElement;
      const element = ref.current;
      const overflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      element.showModal();
      const trapFocus = (event) => {
        if (event.key !== "Tab")
          return;
        const controls = [
          ...element.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')
        ].filter((control) => control.getClientRects().length > 0);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) {
          event.preventDefault();
          element.focus();
          return;
        }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };
      element.addEventListener("keydown", trapFocus);
      return () => {
        document.body.style.overflow = overflow;
        element.removeEventListener("keydown", trapFocus);
        element.close();
        previousFocus?.focus();
      };
    }, [open]);
    if (!open)
      return null;
    return overlay(node(
      "dialog",
      { ref, "aria-labelledby": titleId, onCancel: (event) => {
        event.preventDefault();
        onClose();
      }, onClick: (event) => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)
            onClose();
        }
      }, className: "shara-015 shara-066 shara-077 shara-088 shara-136 shara-141 shara-151 shara-195 shara-205 shara-269 shara-285 shara-297", __site: "ui-11911" },
      node(
        "div",
        { className: "shara-035 shara-044 shara-108 shara-109 shara-117", __site: "ui-12605" },
        node("h2", { id: titleId, className: "shara-236 shara-243 shara-251 shara-267", __site: "ui-12675" }, tr(title)),
        node(
          Button,
          { variant: "ghost", "aria-label": tr("বন্ধ করুন"), onClick: onClose, __site: "ui-12792" },
          node(X, { size: 20, __site: "ui-12874" })
        )
      ),
      node("div", { className: "shara-270", __site: "ui-12927" }, children),
      footer && node("div", { className: "shara-028 shara-044 shara-103 shara-111 shara-116", __site: "ui-12993" }, footer)
    ), document.body);
  }
  var Select = ({ className = "", ...props }) => node("select", { className: `${inputCls} ${className}`, ...props, __site: "ui-16761" });

  // store.js
  var STORAGE_KEY = "shara-demo-v1";
  var storageWarning = "";
  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.version === VERSION && [
          "accounts",
          "requests",
          "missions",
          "teams",
          "organizations",
          "memberships",
          "volunteers",
          "suppliers"
        ].every((key) => Array.isArray(parsed[key])))
          return parsed;
        storageWarning = "সংরক্ষিত তথ্যের সংস্করণ বদলেছে; প্রাথমিক তথ্য ব্যবহার হচ্ছে।";
      }
    } catch {
      storageWarning = "সংরক্ষিত তথ্য পড়া যায়নি; এই সেশনে প্রাথমিক তথ্য ব্যবহার হচ্ছে।";
    }
    return seed();
  }
  var state = readState();
  var listeners2 =  new Set();
  var publish2 = (next) => {
    state = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      storageWarning = "ব্রাউজারে তথ্য সংরক্ষণ করা যায়নি। রিফ্রেশে এই সেশনের পরিবর্তন হারাতে পারে।";
    }
    listeners2.forEach((fn) => fn());
  };
  function act(action) {
    try {
      publish2(transition(state, action));
      return { ok: true, error: "" };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "আবার চেষ্টা করুন।"
      };
    }
  }
  var resetDemo = () => {
    storageWarning = "";
    publish2(seed());
  };
  var getStorageWarning = () => storageWarning;
  var demoState = () => subscribeState((fn) => {
    listeners2.add(fn);
    return () => {
      listeners2.delete(fn);
    };
  }, () => state);
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      state = readState();
      listeners2.forEach((fn) => fn());
    }
  });

  // layouts.js
  var roleNav = {
    volunteer: [
      ["/volunteer", "ড্যাশবোর্ড", LayoutDashboard],
      ["/volunteer/missions", "আমার কার্যক্রম", Flag],
      ["/volunteer/organization", "আমার সংগঠন", Building2],
      ["/volunteer/team", "আমার ছোট দল", Users],
      ["/volunteer/requests", "সহায়তার আবেদন", ClipboardList],
      ["/volunteer/profile/edit", "প্রোফাইল ও প্রাপ্যতা", HeartHandshake]
    ],
    org: [
      ["/org", "ড্যাশবোর্ড", LayoutDashboard],
      ["/org/memberships", "সদস্যপদের অনুরোধ", ClipboardList],
      ["/org/volunteers", "স্বেচ্ছাসেবক", Users],
      ["/org/teams", "ছোট দলসমূহ", Users],
      ["/org/missions", "কার্যক্রম", Flag],
      ["/org/profile", "সংগঠনের প্রোফাইল", Building2]
    ],
    admin: [
      ["/admin", "সারসংক্ষেপ", LayoutDashboard],
      ["/admin/requests", "সহায়তার আবেদন", ClipboardList],
      ["/admin/missions", "কার্যক্রম", Flag],
      ["/admin/organizations", "সংগঠন যাচাই", Building2],
      ["/admin/teams", "দল ও প্রাপ্যতা", Users],
      ["/admin/suppliers", "সরবরাহকারী ও সম্পদ", Package]
    ]
  };
  var publicNav = [
    ["/", "হোম"],
    ["/apply", "সাহায্যের আবেদন"],
    ["/map", "বন্যা পরিস্থিতি"],
    ["/track", "আবেদন ট্র্যাক করুন"],
    ["/volunteer/register", "স্বেচ্ছাসেবক নিবন্ধন"],
    ["/organization/register", "সংগঠন নিবন্ধন"],
    ["/login", "লগইন"]
  ];
  var roleLabels = {
    volunteer: "স্বেচ্ছাসেবক",
    org: "সংগঠনের প্রশাসক",
    admin: "সুপার অ্যাডমিন"
  };
  function ScrollTop() {
    const { pathname } = readLocation();
    afterPaint(() => {
      window.scrollTo(0, 0);
    }, [pathname]);
    return null;
  }
  function LanguageSwitcher() {
    const { language: language2, setLanguage: setLanguage2, tr } = languageContext();
    return node(
      "div",
      { role: "group", "aria-label": tr("ভাষা নির্বাচন করুন"), className: "shara-047 shara-096 shara-106 shara-112 shara-145 shara-150 shara-169 shara-195 shara-199 shara-267", __site: "layouts-2185" },
      node(Languages, { size: 16, "aria-hidden": "true", className: "shara-016", __site: "layouts-2383" }),
      [
        ["bn", "বাংলা"],
        ["en", "English"]
      ].map(([value, label]) => node(Button, { key: value, size: "sm", variant: language2 === value ? "primary" : "ghost", className: "shara-067 shara-139 shara-207", lang: value, "aria-pressed": language2 === value, onClick: () => setLanguage2(value), __site: "layouts-2548" }, label))
    );
  }
  function NavItems({ items, close, dark = false }) {
    const { tr } = languageContext();
    return node(fragment, null, items.map(([to, label]) => node(NavLink, { key: to, to, end: ["/", "/org", "/volunteer", "/admin"].includes(to), onClick: close, className: ({ isActive }) => `shara-044 shara-070 shara-096 shara-106 shara-259 shara-145 shara-210 shara-253 ${isActive ? dark ? "shara-195 shara-267" : "shara-187 shara-267" : dark ? "shara-272 shara-306" : "shara-270 shara-304"}`, __site: "layouts-3156" }, tr(label))));
  }
  function DemoControl() {
    const { tr } = languageContext();
    const s = demoState(), nav = navigation();
    const [open, setOpen] = stateValue(false), [reset, setReset] = stateValue(false);
    const a = account(s);
    return node(
      fragment,
      null,
      node(Button, { size: "sm", variant: "secondary", onClick: () => setOpen(true), __site: "layouts-4039" }, tr("ডেভেলপার নিয়ন্ত্রণ")),
      node(
        Dialog,
        { open, onClose: () => {
          setOpen(false);
          setReset(false);
        }, title: tr("ডেভেলপার নিয়ন্ত্রণ"), __site: "layouts-4159" },
        node(
          "div",
          { className: "shara-124", __site: "layouts-4332" },
          node(
            Select,
            { "aria-label": tr("অ্যাকাউন্ট বদলান"), value: a?.id ?? "", onChange: (e) => {
              act({ type: "login", id: e.target.value || null });
              setOpen(false);
              const target = s.accounts.find((x) => x.id === e.target.value);
              nav(target ? `/${target.role === "volunteer" ? "volunteer" : target.role}` : "/");
            }, __site: "layouts-4370" },
            node("option", { value: "", __site: "layouts-4908" }, tr("পাবলিক ব্যবহারকারী")),
            s.accounts.map((x) => node(
              "option",
              { key: x.id, value: x.id, __site: "layouts-4997" },
              x.name,
              " — ",
              tr(roleLabels[x.role])
            ))
          ),
          node(
            "details",
            { __site: "layouts-5167" },
            node("summary", { className: "shara-099 shara-255 shara-267", __site: "layouts-5189" }, tr("পৃষ্ঠা সূচি")),
            node(
              "div",
              { className: "shara-025 shara-045 shara-117 shara-328", __site: "layouts-5308" },
              node(
                "nav",
                { __site: "layouts-5371" },
                node(NavItems, { items: publicNav, close: () => setOpen(false), __site: "layouts-5393" })
              ),
              Object.entries(roleNav).map(([role, items]) => node(
                "nav",
                { key: role, "aria-label": tr(`${role} পৃষ্ঠা সূচি`), __site: "layouts-5537" },
                node("p", { className: "shara-255", __site: "layouts-5628" }, tr(roleLabels[role])),
                node(NavItems, { items, close: () => setOpen(false), __site: "layouts-5712" })
              ))
            ),
            node("p", { className: "shara-242", __site: "layouts-5840" }, tr("সঠিক অ্যাকাউন্ট নির্বাচন না করলে সংরক্ষিত পৃষ্ঠায় প্রবেশ করা যাবে না।"))
          ),
          reset ? node(
            Alert,
            { kind: "warn", title: tr("সব স্থানীয় পরিবর্তন মুছে যাবে"), __site: "layouts-6002" },
            node(
              "div",
              { className: "shara-025 shara-044 shara-114", __site: "layouts-6094" },
              node(Button, { variant: "danger", onClick: () => {
                resetDemo();
                setOpen(false);
                nav("/");
              }, __site: "layouts-6144" }, tr("হ্যাঁ, তথ্য রিসেট করুন")),
              node(Button, { variant: "secondary", onClick: () => setReset(false), __site: "layouts-6431" }, tr("বাতিল"))
            )
          ) : node(Button, { variant: "secondary", onClick: () => setReset(true), __site: "layouts-6590" }, tr("তথ্য রিসেট করুন"))
        )
      )
    );
  }
  function PublicLayout() {
    const { tr, language: language2, setLanguage: setLanguage2 } = languageContext();
    demoState();
    const [open, setOpen] = stateValue(false);
    const [languageOpen, setLanguageOpen] = stateValue(false);
    return node(
      "div",
      { className: "shara-044 shara-074 shara-102", __site: "layouts-6987" },
      node(ScrollTop, { __site: "layouts-7043" }),
      node(
        "header",
        { className: "shara-004 shara-005 shara-014 shara-156 shara-169 shara-192 shara-292", __site: "layouts-7063" },
        node(
          "div",
          { className: "shara-017 shara-044 shara-072 shara-084 shara-103 shara-106 shara-116 shara-212 shara-216 shara-333", __site: "layouts-7157" },
          node(
            Link,
            { to: "/", "aria-label": tr("SHARA হোম"), __site: "layouts-7264" },
            node(Logo, { __site: "layouts-7319" })
          ),
          node(
            "nav",
            { "aria-label": tr("প্রধান মেনু"), className: "shara-040 shara-046 shara-112 shara-368", __site: "layouts-7356" },
            node(NavItems, { items: publicNav.filter(([to]) => ["/", "/map", "/track"].includes(to)), __site: "layouts-7443" })
          ),
          node(
            "div",
            { className: "shara-041 shara-044 shara-087 shara-103 shara-106 shara-111 shara-114", __site: "layouts-7556" },
            node(
              "div",
              { className: "shara-046 shara-322", __site: "layouts-7651" },
              node(LanguageSwitcher, { __site: "layouts-7699" })
            ),
            node(
              Button,
              { variant: "secondary", className: "shara-207 shara-320", "aria-label": tr("ভাষা নির্বাচন করুন"), "aria-haspopup": "dialog", "aria-expanded": languageOpen, onClick: () => setLanguageOpen(true), __site: "layouts-7751" },
              node(Languages, { size: 20, "aria-hidden": "true", __site: "layouts-8048" })
            ),
            node(Button, { to: "/login", variant: "ghost", className: "shara-042 shara-321", __site: "layouts-8125" }, tr("লগইন")),
            node(Button, { to: "/apply", className: "shara-175 shara-300", __site: "layouts-8301" }, tr("সাহায্যের আবেদন")),
            node(
              Button,
              { variant: "secondary", "aria-label": tr("প্রধান মেনু খুলুন"), "aria-expanded": open, onClick: () => setOpen(true), __site: "layouts-8406" },
              node(Menu, { size: 20, __site: "layouts-8606" })
            )
          )
        )
      ),
      node(
        Dialog,
        { open: languageOpen, onClose: () => setLanguageOpen(false), title: tr("ভাষা নির্বাচন করুন"), __site: "layouts-8701" },
        node("div", { className: "shara-044 shara-116", __site: "layouts-8841" }, [
          ["bn", "বাংলা"],
          ["en", "English"]
        ].map(([value, label]) => node(Button, { key: value, variant: language2 === value ? "primary" : "secondary", className: "shara-095", lang: value, "aria-pressed": language2 === value, onClick: () => {
          setLanguage2(value);
          setLanguageOpen(false);
        }, __site: "layouts-8991" }, label)))
      ),
      node(
        Dialog,
        { open, onClose: () => setOpen(false), title: tr("প্রধান মেনু"), __site: "layouts-9446" },
        node(
          "nav",
          { className: "shara-045 shara-112", __site: "layouts-9532" },
          node(NavItems, { items: publicNav, close: () => setOpen(false), __site: "layouts-9571" })
        )
      ),
      node(
        "main",
        { id: "main", className: "shara-095", __site: "layouts-9668" },
        getStorageWarning() && node(
          "div",
          { className: "shara-017 shara-084 shara-203", __site: "layouts-9735" },
          node(Alert, { kind: "warn", __site: "layouts-9775" }, tr(getStorageWarning()))
        ),
        node(Outlet, { __site: "layouts-9843" })
      ),
      node(
        "footer",
        { className: "shara-184 shara-272", __site: "layouts-9874" },
        node(
          "div",
          { className: "shara-017 shara-045 shara-084 shara-119 shara-212 shara-221 shara-333 shara-343", __site: "layouts-9923" },
          node(
            "div",
            { __site: "layouts-10014" },
            node(Logo, { light: true, __site: "layouts-10032" }),
            node("p", { className: "shara-026 shara-088", __site: "layouts-10059" }, "SHARA — Structured Humanitarian Assistance and Response Alliance"),
            node(
              "div",
              { className: "shara-026 shara-044 shara-103 shara-116", __site: "layouts-10197" },
              node(DemoControl, { __site: "layouts-10255" }),
              node(Button, { to: "/privacy", variant: "ghost", className: "shara-272 shara-308", __site: "layouts-10285" }, tr("গোপনীয়তা নীতি"))
            )
          ),
          node(
            "nav",
            { "aria-label": tr("ফুটার মেনু"), className: "shara-045 shara-328", __site: "layouts-10521" },
            node(NavItems, { items: publicNav, dark: true, __site: "layouts-10601" })
          )
        )
      )
    );
  }

  // bdgeo.js
  var W = 400;
  var H = 543;
  var OUTLINE = "M300.5 391.9L302.6 391L304.1 388.8L304.1 384L299.9 377.9L298.1 373.7L294.7 370.3L291.4 374.3L289.6 380.3L291.4 384.6L293.2 386.4L295 390.1L297.2 392.2L300.2 392.2ZM368.5 535.8L366.1 530.9L363.6 521.8L360.6 518.8L360 512.7L359.4 512.1L359.4 506.6L360 505.4L354.5 500L354.5 492.7L356.4 490.8L356.4 486.6L355.1 485.4L355.1 481.1L359.4 478.1L359.4 476.3L360.9 473.5L365.2 473.5L367 469.9L372.4 469.9L375.2 472L375.2 475.7L376.1 476.6L379.7 476.6L380.9 474.8L385.2 474.8L386.1 475.7L386.1 478.1L388.8 485.1L390.7 483.3L394 481.7L391.6 476.3L391.6 473.2L389.7 468.4L389.1 461.7L387.9 459.3L387.9 435.6L388.5 432.6L390.4 430.7L387.9 427.7L386.7 416.2L384.9 412.5L384.9 408.3L387 408L387.3 406.4L386.1 403.4L385.5 393.1L384.9 390.1L383.7 388.2L383.1 379.1L381.9 374.9L381.9 368.2L379.4 359.7L376.4 355.4L376.4 352.4L375.2 350.6L375.2 346.3L372.7 343.9L371.8 341.8L370.6 341.8L368.5 340.3L368.5 335.4L369.7 329.3L367.3 326.3L366.7 314.2L369.4 313.2L369.7 312.3L368.5 308.7L368.5 303.8L366.7 302.6L366.1 299L364.2 296.5L363 286.2L360.6 282.6L361.2 274.7L359.7 273.2L358.5 273.2L357.9 276.2L354.2 276.2L353.9 274.7L351.8 273.8L350.6 272L344.5 278.6L339 278.6L336.9 275.9L336.3 272.9L335.1 272.9L335.1 275.3L333.9 276.5L333.9 277.7L335.1 281.4L336.3 294.7L333.9 296.5L333.6 298.7L330.5 298.7L326.3 301.7L326 303.8L319.3 309.9L319.3 311.7L321.7 314.8L322.4 318.4L324.2 322.7L324.8 329.9L322.4 331.8L321.4 333.9L320.2 333.9L317.2 336.9L310.5 337.5L309.3 338.7L305 338.7L303.8 337.5L302.6 337.5L300.5 334.8L300.5 332.4L299.3 331.2L299.3 326.9L298.1 325.7L298.1 323.9L296.2 320.8L296.2 318.4L295 317.8L295 316L293.2 315.4L293.2 313.5L291.7 311.4L290.8 311.7L288.3 316L288.3 320.2L290.2 323.9L290.2 327.5L285.6 327.8L284.1 326.3L282.3 320.8L281.7 311.1L280.5 309.3L280.5 306.9L279.2 305.7L279.2 302L278 300.2L278 297.2L275.6 293.5L275.6 291.1L271.3 287.4L270.7 283.2L267.7 280.2L267.7 274.1L271 273.8L271.3 272.9L267.1 271.6L267.1 267.4L268.6 265.3L273.2 265.6L273.2 261.9L275 258.9L275 257.1L273.8 255.3L274.4 249.8L277.4 248.6L278 244.9L279.5 243.4L284.4 244L285.3 243.1L286.5 240.1L286.5 238.3L285.3 236.4L285.6 232.5L289.9 232.5L292.3 233.7L295.9 233.7L297.8 234.9L301.4 235.5L303.2 234.9L303.8 233.7L306.3 233.7L307.2 232.8L307.2 227.9L308.1 226.4L311.7 226.4L312.3 227.6L316.6 229.4L317.2 222.2L325.7 222.8L326 224.9L327.8 226.7L328.4 229.1L329.6 229.1L332.1 219.4L331.5 211.5L333 210L335.1 209.7L335.4 207L339.7 207L340.3 207.6L346.9 207L348.5 203.6L350.3 202.4L349.7 194.5L353.6 194.2L354.8 195.4L355.7 195.1L357.6 181.8L358.2 179.4L360.6 175.7L360 167.8L357 165.4L357 158.7L362.7 158.4L364.6 160.2L366.4 160.2L370.6 163.3L373.1 162.7L374.3 161.4L377.3 161.4L377 156.9L374.9 156.6L371.5 153.2L371.2 148.7L367 146.9L365.2 146.9L364.6 144.4L359.7 144.4L356.1 143.2L353.6 140.8L351.8 140.8L348.2 139L346.9 136.5L343.3 134.7L316.6 136.5L316 137.8L312.3 137.8L312 139.3L309.3 140.8L305.7 140.8L305 139.6L302.9 138.7L302.6 136.5L302 137.8L299 139.6L292.3 140.2L291.7 139L289.9 139L288 137.8L281.4 137.2L277.1 134.7L269.2 134.7L268.6 135.3L260.7 134.7L258.9 135.9L251 136.5L249.8 137.8L244.3 137.8L243.7 138.4L238.9 138.4L236.4 136.5L235.2 136.5L232.8 138.4L227.9 138.4L226.1 137.8L225.5 136.5L221.9 136.5L221.3 137.2L212.8 137.8L210.3 139L204.9 139L201.8 138.4L198.2 135.3L189.1 134.7L185.4 132.9L180 132.9L175.1 129.3L173.9 129.3L171.5 127.4L169 127.4L167.8 125.6L164.2 125.6L163.6 125L161.7 126.8L157.5 126.8L156.6 125.3L156.6 122.3L155.4 121.1L155.4 116.8L157.8 110.7L158.4 103.5L159.6 101.6L160.2 98.6L160.2 94.3L157.8 90.7L157.2 88.3L156.6 73.1L160.2 67.6L157.2 67L157.2 64.6L155.4 63.4L155.4 60.3L152.9 59.7L153.5 54.9L152.3 54.3L149.9 48.2L144.7 47.9L144.4 44.6L143.2 43.3L143.2 42.1L142 42.1L142 46.4L139.9 46.7L138.4 48.8L140.8 49.4L142 52.5L142 56.1L138.7 57.6L137.2 59.7L136.9 64.9L132.6 64.9L132 61.9L126.5 61.3L125.3 58.8L122.3 58.8L121.7 59.4L114.4 58.8L113.8 57.6L111.3 57.6L109.8 56.7L109.2 53.7L107.1 50.9L102.8 50.3L101.3 49.4L100.1 46.4L100.1 40.9L97.1 36.1L95.6 26L91.3 25.4L90.7 24.2L88.3 23.6L86.5 20.6L85.5 20.9L85.5 22.1L83.1 24.5L83.1 26.3L84 27.3L85.8 27.3L88.6 28.8L89.2 31.8L90.1 32.7L91.3 32.7L91.9 33.9L94.7 34.2L94.3 38.8L84.6 38.8L82.2 35.1L79.2 35.1L78.3 36.1L78 38.8L74.3 38.8L72.8 37.3L72.5 33.3L68.2 33.3L67.9 30.6L67 29.7L63.4 29.7L61.3 24.5L57 21.5L57 19.1L51.8 19.4L51.2 17.5L49.4 17.5L49.1 16L45.2 12.1L42.7 12.1L41.2 10.6L40.6 6.9L39.7 6L38.2 7.5L36.4 14.2L34.5 16L40.3 15.7L40.9 16.9L46.4 18.1L47.9 20.3L48.5 23.3L49.7 24.5L49.7 28.8L45.2 29.1L43.9 28.5L40.9 32.1L38.5 32.7L35.8 35.4L35.4 41.2L33 41.8L32.4 43L29.4 44.3L26.9 44.3L25.1 46.1L21.8 47.6L21.8 49.4L20.6 51.2L21.2 58.5L17.5 61.6L15.7 67L13.9 67.6L13.9 68.8L15.1 70.1L15.1 76.1L16.6 78.3L19.1 79.5L23.3 78.3L28.8 78.3L29.1 80.4L33.6 84.3L37.3 86.2L37.6 87.7L40.3 90.4L43.6 91.3L43 96.8L45.2 98.3L47 98.3L47.3 101L49.4 101.9L52.5 105.6L59.1 106.2L61 108.6L62.8 108.6L64 106.2L67 106.2L68.2 104.4L72.5 104.4L72.8 106.5L75.2 108.3L75.2 112L74.6 112.6L75.2 118L78.6 121.4L80.4 121.4L81.6 123.2L86.5 123.8L86.8 127.7L84.3 129.6L83.4 136.5L77.3 136.5L74.9 134.1L73.1 136.5L68.8 136.5L65.8 135.9L63.4 133.5L56.1 134.1L54.3 135.3L48.8 135.3L48.2 134.1L45.8 133.5L42.7 134.7L43 140.5L42.4 141.1L41.8 151.4L40 152.6L39.7 154.2L37.6 155.1L37.6 157.5L33.3 158.1L32.4 163.3L26.3 162.7L26 159.9L22.7 156L21.5 156L17.2 158.4L16.9 159.3L18.8 161.1L18.8 165.4L16.3 167.2L16 169.3L13.9 169.6L13.9 172.1L11.5 172.7L10.3 178.1L7.5 179.7L6 182.4L9 184.8L13.3 192.7L21.5 200.9L23.9 200.9L26.9 202.1L31.8 207.6L33 208.2L41.5 208.2L46.4 211.2L48.2 211.2L50 214.3L56.7 214.3L57.3 214.9L57.9 214.3L62.8 214.3L64.9 215.8L66.1 218.8L66.1 222.5L65.5 223.1L66.1 230.4L64.3 231.6L64.9 235.8L66.1 236.4L65.5 251L60.3 253.7L59.7 255L55.5 255L54 255.9L52.1 268.6L51.5 269.2L51.5 274.7L54 275.3L54.3 278L57.9 278L58.8 282L66.4 289L70.4 289.3L70.4 294.1L67.9 295.3L67.3 301.4L66.1 302.6L66.1 306.3L63.7 308.1L64.9 308.7L64.9 310.5L67.6 310.8L69.5 313.2L70.7 312L76.7 312L79.8 312.6L81.6 314.5L83.1 314.8L83.1 318.4L81.9 319.6L81.9 321.4L76.4 326.9L77 328.1L77 334.2L76.4 336.6L75.2 337.2L78.3 337.8L79.5 343.9L82.2 344.2L83.7 346.3L83.7 353.6L80.1 356.7L80.1 358.5L82.5 360.9L82.5 366.4L81.3 367.6L82.5 368.8L82.5 374.3L84.9 376.7L84.9 380.3L86.8 382.2L86.8 387L85.5 388.2L86.2 389.4L86.2 394.9L88 396.1L88 399.8L89.8 401.6L89.8 403.4L91.6 405.2L92.2 414.3L91 415.6L91 419.2L94 423.4L94 428.3L92.8 431.9L90.1 432.3L89.2 433.2L89.8 436.2L89.2 444.1L92.2 446.5L94.3 450.5L96.8 450.5L98.3 448.3L98.6 446.2L102.2 446.2L103.2 447.1L103.2 452.6L101.3 455.6L102.8 457.1L106.5 457.1L108.3 455.3L110.1 455.3L110.7 453.5L114.4 453.5L116.2 451.1L121.7 450.5L123.2 449L123.2 446.5L125.3 445.6L126.5 443.2L130.2 443.2L131.7 444.7L131.7 450.2L132.6 451.1L136.9 451.1L137.5 447.4L142.9 447.4L145 445.9L145.4 440.8L151.4 440.8L152.6 439.5L153.9 439.5L156.3 436.5L158.7 436.5L159.6 435.6L159.6 431.3L158.4 425.3L157.2 422.8L157.2 418.6L159.3 416.5L163.3 416.8L163.3 421L164.5 422.8L164.5 424.7L167.8 428.6L169.6 428L173.6 428.3L173.6 437.4L173 438L175.1 440.1L178.1 440.1L178.4 441.7L181.2 443.8L187.9 444.4L193.9 440.1L197.6 440.1L198.8 442.6L201.2 443.2L201.8 442.6L213.4 443.2L214 438.3L220 437.7L220.6 439.5L224.3 439.5L224.9 440.1L225.8 438.6L225.8 435L228.5 433.5L232.5 433.8L232.5 439.8L230.1 441.1L230.1 442.9L233.4 443.2L234.9 441.7L234.3 436.8L235.5 434.4L234 432.9L232.5 432.6L233.1 422.8L236.7 419.8L239.8 414.3L241.3 412.8L244.9 412.8L245.8 419.8L248.6 420.1L249.5 416.2L252.2 413.4L255.9 413.4L256.2 418L258.3 420.1L260.7 420.7L261.9 421.9L262.2 419.8L263.8 419.5L265.9 416.8L267.1 411.9L269.5 409.5L269.5 407.7L270.7 405.8L271.3 399.8L269.5 396.7L269.5 391.9L272.3 391.6L273.2 390.7L273.2 386.4L268 381.9L265 381.9L263.1 380.6L254.6 381.2L254.3 376.1L257.1 375.2L258.9 372.7L262.5 372.7L263.8 374.6L267.4 373.4L277.1 374L278.6 372.4L278.6 365.8L282.6 365.5L285.3 362.7L285.3 359.1L286.8 357.6L290.5 357.6L291.7 358.8L297.2 358.8L301.1 362.1L303.5 366.4L313.8 379.1L318.1 388.2L318.1 393.1L319.3 396.1L319.3 399.8L323 405.2L325.4 414.3L326.6 414.9L326.6 421L328.4 422.8L328.4 428.9L325.4 431.9L325.4 442.9L324.2 444.7L324.2 447.1L326 447.7L326 452L327.8 453.8L328.4 462.9L326.6 464.7L327.2 466.6L328.7 466.9L330.2 468.4L330.9 470.8L332.4 472.3L336 473.5L339.4 478.1L341.8 484.8L341.8 494.5L343 496.9L353.3 509.1L355.7 517.6L360.6 524.9L362.4 529.1L362.4 531.5L366.4 536.1L368.2 536.1Z";
  var DISTRICT_SHAPES = [{ "name": "পঞ্চগড়", "d": "M34.5 16L36.4 14.2L38.2 7.5L39.7 6L40.6 6.9L41.2 10.6L42.7 12.1L45.2 12.1L49.1 16L49.4 17.5L51.2 17.5L51.8 19.4L57 19.1L57 21.5L61.3 24.5L63.4 29.7L67 29.7L67.9 30.6L68.2 33.3L72.5 33.3L72.79666750820499 37.25556677606666L60.26413802303348 58.19058762061452L35.60680088776158 38.201387127457195L35.8 35.4L38.5 32.7L40.9 32.1L43.9 28.5L45.2 29.1L49.7 28.8L49.7 24.5L48.5 23.3L47.9 20.3L46.4 18.1L40.9 16.9L40.3 15.7Z", "c": [53.7, 35.8], "subs": [{ "d": "M34.5 16L36.4 14.2L38.2 7.5L39.7 6L40.6 6.9L41.2 10.6L42.7 12.1L45.2 12.1L49.1 16L49.4 17.5L51.2 17.5L51.8 19.4L57 19.1L57 21.5L57.525205414346935 21.866422382102513L51.035555671866916 28.372185025238064L49.7 27.833103820012404L49.7 24.5L48.5 23.3L47.9 20.3L46.4 18.1L40.9 16.9L40.3 15.7Z", "c": [45.6, 17] }, { "d": "M50.77892604446791 34.182142359195325L51.035555671866916 28.372185025238064L57.525205414346935 21.866422382102513L61.3 24.5L63.4 29.7L67 29.7L67.9 30.6L68.2 33.3L72.5 33.3L72.79666750820499 37.25556677606666L64.02430928502324 51.90939244433619Z", "c": [62.4, 33.8] }, { "d": "M39.482501003957964 41.34333819252902L50.77892604446791 34.182142359195325L64.02430928502324 51.90939244433619L60.26413802303348 58.19058762061452Z", "c": [47.1, 45.3] }, { "d": "M35.60680088776158 38.201387127457195L35.8 35.4L38.5 32.7L40.9 32.1L43.9 28.5L45.2 29.1L49.7 28.8L49.7 27.833103820012404L51.035555671866916 28.372185025238064L50.77892604446791 34.182142359195325L39.482501003957964 41.34333819252902Z", "c": [39.2, 32.8] }] }, { "name": "ঠাকুরগাঁও", "d": "M13.9 67.6L15.7 67L17.5 61.6L21.2 58.5L20.6 51.2L21.8 49.4L21.8 47.6L25.1 46.1L26.9 44.3L29.4 44.3L32.4 43L33 41.8L35.4 41.2L35.60680088776158 38.201387127457195L60.26413802303348 58.19058762061452L60.72376631259483 65.25354233687405L35.3351888120448 85.19104290348247L33.6 84.3L29.1 80.4L28.8 78.3L23.3 78.3L19.1 79.5L16.6 78.3L15.1 76.1L15.1 70.1L13.9 68.8Z", "c": [37, 56.4], "subs": [{ "d": "M33.785315110728185 84.39516181361718L37.38930183095146 59.980080461685674L41.345784869770355 55.55768107139678L42.86068791205951 55.08526291273278L50.66463125515915 61.21984726426972L51.441340301546916 72.54297688084404L35.3351888120448 85.19104290348247Z", "c": [44, 65.3] }, { "d": "M25.412159917554703 57.56760806844871L27.7000310151558 44.3L27.89129511985377 44.3L41.345784869770355 55.55768107139678L37.38930183095146 59.980080461685674Z", "c": [31.3, 54] }, { "d": "M42.86068791205951 55.08526291273278L46.88037789260638 47.34064615565663L59.288058770411894 57.39930007115916L50.66463125515915 61.21984726426972Z", "c": [53.1, 53.8] }, { "d": "M16.590326199487876 64.32902140153638L17.5 61.6L21.2 58.5L20.6 51.2L21.8 49.4L21.8 47.6L25.1 46.1L26.9 44.3L27.7000310151558 44.3L25.412159917554703 57.56760806844871Z", "c": [21, 52.2] }, { "d": "M50.66463125515915 61.21984726426972L59.288058770411894 57.39930007115916L60.26413802303348 58.19058762061452L60.72376631259483 65.25354233687405L51.441340301546916 72.54297688084404Z", "c": [57.8, 64.4] }, { "d": "M27.89129511985377 44.3L29.4 44.3L32.4 43L33 41.8L35.4 41.2L35.60680088776158 38.201387127457195L46.88037789260638 47.34064615565663L42.86068791205951 55.08526291273278L41.345784869770355 55.55768107139678Z", "c": [38, 46] }, { "d": "M13.9 67.6L15.7 67L16.590326199487876 64.32902140153638L25.412159917554703 57.56760806844871L37.38930183095146 59.980080461685674L33.785315110728185 84.39516181361718L33.6 84.3L29.1 80.4L28.8 78.3L23.3 78.3L19.1 79.5L16.6 78.3L15.1 76.1L15.1 70.1L13.9 68.8Z", "c": [29.5, 63.2] }] }, { "name": "নীলফামারী", "d": "M60.26413802303348 58.19058762061452L72.79666750820499 37.25556677606666L72.8 37.3L74.3 38.8L78 38.8L78.3 36.1L79.2 35.1L82.2 35.1L84.6 38.8L94.3 38.8L94.7 34.2L91.9 33.9L91.3 32.7L90.1 32.7L89.2 31.8L88.6 28.8L85.8 27.3L84 27.3L83.1 26.3L83.1 24.5L85.5 22.1L85.5 20.9L86.5 20.6L88.3 23.6L90.7 24.2L91.3 25.4L95.6 26L97.1 36.1L100.1 40.9L100.1 45.64166666666671L92.49766734279919 75.41746957403652L86.8702177476001 78.96276281901194L60.72376631259483 65.25354233687405Z", "c": [83.1, 53.4], "subs": [{ "d": "M89.65854588619881 44.903179990783876L92.65878735848374 38.8L94.3 38.8L94.65270275755364 34.74391828813318L96.37751346189036 31.235257310061762L97.1 36.1L100.1 40.9L100.1 45.64166666666671L98.23392841429398 52.95044704401523L91.85297423069738 51.882245757916756Z", "c": [96.4, 47.3] }, { "d": "M87.2277567135804 57.95423156376718L91.85297423069738 51.882245757916756L98.23392841429398 52.95044704401523L95.13243401410875 65.0979667780741L88.52210148242507 63.82698299558751Z", "c": [94.6, 57.7] }, { "d": "M76.30410321095658 52.36928520228422L79.61572431130968 46.86830748386692L89.65854588619881 44.903179990783876L91.85297423069738 51.882245757916756L87.2277567135804 57.95423156376718Z", "c": [85.5, 50.7] }, { "d": "M60.301781656678884 58.76904479096552L76.30410321095658 52.36928520228422L87.2277567135804 57.95423156376718L88.52210148242507 63.82698299558751L78.35076345923196 74.49580570565135L60.72376631259483 65.25354233687405Z", "c": [80.4, 60.8] }, { "d": "M77.73167981882929 38.8L78 38.8L78.3 36.1L79.2 35.1L82.2 35.1L84.6 38.8L92.65878735848374 38.8L89.65854588619881 44.903179990783876L79.61572431130968 46.86830748386692ZM83.1 24.5L85.5 22.1L85.5 20.9L86.5 20.6L88.3 23.6L90.7 24.2L91.3 25.4L95.6 26L96.37751346189036 31.235257310061762L94.65270275755364 34.74391828813318L94.7 34.2L91.9 33.9L91.3 32.7L90.1 32.7L89.2 31.8L88.6 28.8L85.8 27.3L84 27.3L83.1 26.3Z", "c": [83.6, 41.1] }, { "d": "M60.26413802303348 58.19058762061452L72.79666750820499 37.25556677606666L72.8 37.3L74.3 38.8L77.73167981882929 38.8L79.61572431130968 46.86830748386692L76.30410321095658 52.36928520228422L60.301781656678884 58.76904479096552Z", "c": [73.4, 43.4] }, { "d": "M78.35076345923196 74.49580570565135L88.52210148242507 63.82698299558751L95.13243401410875 65.0979667780741L92.49766734279919 75.41746957403652L86.8702177476001 78.96276281901194Z", "c": [91.9, 71.8] }] }, { "name": "লালমনিরহাট", "d": "M92.49766734279919 75.41746957403652L100.1 45.64166666666671L100.1 46.4L101.3 49.4L102.8 50.3L107.1 50.9L109.2 53.7L109.8 56.7L111.3 57.6L113.8 57.6L114.4 58.8L121.7 59.4L122.3 58.8L125.3 58.8L126.5 61.3L132 61.9L132.26447562776957 63.222378138847866L122.56643871456667 78.16766207755184ZM138.4 48.8L139.9 46.7L142 46.4L142 42.1L143.2 42.1L143.2 43.3L144.3698113207547 44.56729559748427L140.9621083455344 49.818779892630545L140.8 49.4Z", "c": [111.3, 60.6], "subs": [{ "d": "M92.49766734279919 75.41746957403652L95.0076138470651 65.58684576566169L106.47714322068192 65.95176186520071L104.38117786091262 76.50437602386397Z", "c": [98.3, 71.6] }, { "d": "M106.5064170534426 65.9251952148104L109.12802680324725 53.604035737663004L109.2 53.7L109.8 56.7L111.3 57.6L113.8 57.6L114.4 58.8L121.7 59.4L122.3 58.8L125.3 58.8L126.5 61.3L132 61.9L132.26447562776957 63.222378138847866L125.59474890047461 73.50084589733623ZM138.4 48.8L139.9 46.7L142 46.4L142 42.1L143.2 42.1L143.2 43.3L144.3698113207547 44.56729559748427L140.9621083455344 49.818779892630545L140.8 49.4Z", "c": [116.2, 63.5] }, { "d": "M104.38117786091262 76.50437602386397L106.47714322068192 65.95176186520071L106.5064170534426 65.9251952148104L125.59474890047461 73.50084589733623L122.56643871456667 78.16766207755184Z", "c": [111.9, 74.4] }, { "d": "M95.0076138470651 65.58684576566169L100.1 45.64166666666671L100.1 46.4L101.3 49.4L102.8 50.3L107.1 50.9L109.12802680324725 53.604035737663004L106.5064170534426 65.9251952148104L106.47714322068192 65.95176186520071Z", "c": [98.6, 59.7] }] }, { "name": "কুড়িগ্রাম", "d": "M122.56643871456667 78.16766207755184L132.26447562776957 63.222378138847866L132.6 64.9L136.9 64.9L137.2 59.7L138.7 57.6L142 56.1L142 52.5L140.9621083455344 49.818779892630545L144.3698113207547 44.56729559748427L144.4 44.6L144.7 47.9L149.9 48.2L152.3 54.3L153.5 54.9L152.9 59.7L155.4 60.3L155.4 63.4L157.2 64.6L157.2 67L160.2 67.6L156.6 73.1L157.2 88.3L157.8 90.7L160.2 94.3L160.2 98.6L159.6 101.6L158.4 103.5L157.98815517565285 108.44213789216607L130.54123088890665 101.16933537378864Z", "c": [143.2, 81.3], "subs": [{ "d": "M132.52701395875332 101.69552213192773L135.96486231609987 97.3188798342253L148.4942243407206 95.13989394418664L153.57554382561509 107.27289755747864Z", "c": [146.5, 103.5] }, { "d": "M135.624428091326 87.04868940688299L141.24218682606116 76.78943020554182L146.85058437544424 79.32840059786082L153.58070213392418 89.90581019211037L148.4942243407206 95.13989394418664L135.96486231609987 97.3188798342253Z", "c": [143.8, 88] }, { "d": "M122.56643871456667 78.16766207755184L124.66831598494791 74.92853720194017L141.11257331295135 76.49624892715164L141.24218682606116 76.78943020554182L135.624428091326 87.04868940688299L124.16296370997819 82.77251516349085Z", "c": [130.4, 80.6] }, { "d": "M124.16296370997819 82.77251516349085L135.624428091326 87.04868940688299L135.96486231609987 97.3188798342253L132.52701395875332 101.69552213192773L130.54123088890665 101.16933537378864Z", "c": [127.5, 88.5] }, { "d": "M148.4942243407206 95.13989394418664L153.58070213392418 89.90581019211037L157.6090008335081 89.93600333403235L157.8 90.7L160.2 94.3L160.2 98.6L159.6 101.6L158.4 103.5L157.98815517565285 108.44213789216607L153.57554382561509 107.27289755747864Z", "c": [155.8, 99.6] }, { "d": "M141.11257331295135 76.49624892715164L142.47983273786292 47.47987128802765L144.3698113207547 44.56729559748427L144.4 44.6L144.7 47.9L149.9 48.2L152.3 54.3L153.5 54.9L152.9 59.7L155.4 60.3L155.4 63.4L157.2 64.6L157.2 67L160.2 67.6L156.6 73.1L156.64599455599839 74.2651954186257L146.85058437544424 79.32840059786082L141.24218682606116 76.78943020554182Z", "c": [151.4, 71.4] }, { "d": "M124.66831598494791 74.92853720194017L132.26447562776957 63.222378138847866L132.6 64.9L136.9 64.9L137.2 59.7L138.7 57.6L142 56.1L142 52.5L140.9621083455344 49.818779892630545L142.47983273786292 47.47987128802765L141.11257331295135 76.49624892715164Z", "c": [131.4, 70.4] }, { "d": "M146.85058437544424 79.32840059786082L156.64599455599839 74.2651954186257L157.2 88.3L157.6090008335081 89.93600333403235L153.58070213392418 89.90581019211037Z", "c": [155.9, 80.3] }] }, { "name": "দিনাজপুর", "d": "M35.3351888120448 85.19104290348247L60.72376631259483 65.25354233687405L86.8702177476001 78.96276281901194L84.49082586881715 114.33638875025174L76.43766006984866 119.23766006984867L75.2 118L74.6 112.6L75.2 112L75.2 108.3L72.8 106.5L72.5 104.4L68.2 104.4L67 106.2L64 106.2L62.8 108.6L61 108.6L59.1 106.2L52.5 105.6L49.4 101.9L47.3 101L47 98.3L45.2 98.3L43 96.8L43.6 91.3L40.3 90.4L37.6 87.7L37.3 86.2Z", "c": [63.7, 90.4], "subs": [{ "d": "M43 96.8L43.3785493935234 93.32996389270214L56.71110222468006 87.05183017822056L58.603806887829826 87.59523787694897L64.85369382972576 106.2L64 106.2L62.8 108.6L61 108.6L59.1 106.2L52.5 105.6L49.4 101.9L47.3 101L47 98.3L45.2 98.3Z", "c": [53.4, 98.8] }, { "d": "M63.040837342078746 85.30955783276936L66.35629572232104 79.89819226997116L78.62228023403651 74.63816855514347L86.8702177476001 78.96276281901194L86.22431554527464 88.56517556025042L79.99561062556815 91.57580838119283Z", "c": [73.2, 83.3] }, { "d": "M35.3351888120448 85.19104290348247L50.40621765818773 73.35585260371727L56.71110222468006 87.05183017822056L43.3785493935234 93.32996389270214L43.6 91.3L40.3 90.4L37.6 87.7L37.3 86.2Z", "c": [45.6, 82.1] }, { "d": "M61.65063514190816 65.73952220954104L78.62228023403651 74.63816855514347L66.35629572232104 79.89819226997116Z", "c": [68.6, 72.6] }, { "d": "M66.83124028398379 106.2L67.03293111350138 106.15060332974794L67 106.2ZM72.75882913715859 106.21180396011009L84.63810401548187 112.14685363650302L84.49082586881715 114.33638875025174L76.43766006984866 119.23766006984867L75.2 118L74.6 112.6L75.2 112L75.2 108.3L72.8 106.5Z", "c": [75.1, 116.3] }, { "d": "M50.40621765818773 73.35585260371727L60.72376631259483 65.25354233687405L61.65063514190816 65.73952220954104L66.35629572232104 79.89819226997116L63.040837342078746 85.30955783276936L58.603806887829826 87.59523787694897L56.71110222468006 87.05183017822056Z", "c": [60.2, 75.4] }, { "d": "M58.603806887829826 87.59523787694897L63.040837342078746 85.30955783276936L79.99561062556815 91.57580838119283L71.352289146448 104.4L68.2 104.4L67.03293111350138 106.15060332974794L66.83124028398379 106.2L64.85369382972576 106.2Z", "c": [69.5, 93.4] }, { "d": "M71.352289146448 104.4L79.99561062556815 91.57580838119283L86.22431554527464 88.56517556025042L84.63810401548187 112.14685363650302L72.75882913715859 106.21180396011009L72.5 104.4Z", "c": [82.2, 102] }] }, { "name": "রংপুর", "d": "M84.49082586881715 114.33638875025174L86.8702177476001 78.96276281901194L92.49766734279919 75.41746957403652L122.56643871456667 78.16766207755184L130.54123088890665 101.16933537378864L106.01635752748555 119.50422472386063Z", "c": [108.3, 93.4], "subs": [{ "d": "M112.66809690941017 103.14017641856374L121.73456383368558 86.94812047982803L124.9876305858128 85.15109978883198L130.54123088890665 101.16933537378864L121.57181231993829 107.87490708349661Z", "c": [119.6, 101.9] }, { "d": "M86.07873560125975 90.72946406127181L86.8702177476001 78.96276281901194L92.49766734279919 75.41746957403652L98.19440826103978 75.93851295070486L98.03494573936695 81.06157111273995L94.84676267731706 86.44150059455455Z", "c": [88.2, 80.2] }, { "d": "M84.49082586881715 114.33638875025174L85.55263737099858 98.55079108448773L102.46578330538792 101.86829021863706L104.85281473168494 106.4100469231431L102.38538481993072 118.63250310161035Z", "c": [93.8, 105.2] }, { "d": "M85.55263737099858 98.55079108448773L86.07873560125974 90.72946406127181L94.84676267731706 86.44150059455455L102.86566824725837 96.48530804059197L102.46578330538792 101.86829021863706Z", "c": [95.7, 95.5] }, { "d": "M102.38538481993072 118.63250310161035L104.85281473168494 106.4100469231431L112.66809690941017 103.14017641856374L121.57181231993829 107.87490708349661L106.01635752748555 119.50422472386063Z", "c": [115.5, 109.6] }, { "d": "M98.03494573936695 81.06157111273995L98.19440826103978 75.93851295070486L122.56643871456667 78.16766207755184L124.9876305858128 85.15109978883198L121.73456383368558 86.94812047982803L112.00097602333 88.29201571482704Z", "c": [107.9, 80.8] }, { "d": "M102.46578330538792 101.86829021863706L102.86566824725837 96.48530804059197L112.00097602333 88.29201571482704L121.73456383368558 86.94812047982803L112.66809690941017 103.14017641856374L104.85281473168494 106.4100469231431Z", "c": [110.1, 96.6] }, { "d": "M94.84676267731706 86.44150059455455L98.03494573936695 81.06157111273995L112.00097602333 88.29201571482704L102.86566824725837 96.48530804059197Z", "c": [103.5, 89.3] }] }, { "name": "গাইবান্ধা", "d": "M106.01635752748555 119.50422472386063L130.54123088890665 101.16933537378864L157.98815517565285 108.44213789216607L157.8 110.7L155.4 116.8L155.4 121.1L156.6 122.3L156.6 125.3L157.32717533887188 126.5119588981198L151.914889728036 139.43810910697786L136.81821372339274 149.80009495078184L119.37874408370664 144.340074082282Z", "c": [131.7, 124.7], "subs": [{ "d": "M121.37152843099301 108.02464008673367L130.54123088890665 101.16933537378864L137.5993753818881 103.03958103437128L137.2671037094157 113.74313521572982L132.56196441571734 114.78376592547004L124.71324124655094 113.04509719627693Z", "c": [127.5, 105.6] }, { "d": "M139.16099882357597 146.89358036427106L141.40403726293872 134.95460880403363L156.6 125.16358069320394L156.6 125.3L157.32717533887188 126.5119588981198L151.914889728036 139.43810910697786L139.4380707303749 148.0018897557581Z", "c": [146.4, 138.3] }, { "d": "M114.06789518407888 134.46912455679586L122.71005845096565 132.6381939735386L126.14259964673857 133.25074407205244L139.16099882357597 146.89358036427106L139.4380707303749 148.0018897557581L136.81821372339274 149.80009495078184L119.37874408370664 144.340074082282Z", "c": [128.7, 142.7] }, { "d": "M134.67854789641495 130.41836366478634L140.7401349977245 116.60747485242715L155.5181953407226 121.21819534072259L156.6 122.3L156.6 125.16358069320394L141.40403726293872 134.95460880403363Z", "c": [140.4, 129] }, { "d": "M109.73267056097721 126.41150811071685L124.71324124655094 113.04509719627693L132.56196441571734 114.78376592547004L122.71005845096565 132.6381939735386L114.06789518407888 134.46912455679586Z", "c": [124.1, 121] }, { "d": "M122.71005845096565 132.6381939735386L132.56196441571734 114.78376592547004L137.2671037094157 113.74313521572982L140.7401349977245 116.60747485242715L134.67854789641495 130.41836366478634L126.14259964673857 133.25074407205244Z", "c": [131.8, 125.2] }, { "d": "M126.14259964673857 133.25074407205244L134.67854789641495 130.41836366478634L141.40403726293872 134.95460880403363L139.16099882357597 146.89358036427106Z", "c": [135.5, 136.3] }, { "d": "M106.01635752748555 119.50422472386063L121.37152843099301 108.02464008673367L124.71324124655094 113.04509719627693L109.73267056097721 126.41150811071685Z", "c": [116.8, 112.8] }, { "d": "M137.2671037094157 113.74313521572982L137.5993753818881 103.03958103437128L157.98815517565285 108.44213789216607L157.8 110.7L155.4 116.8L155.4 121.1L155.5181953407226 121.21819534072259L140.7401349977245 116.60747485242715Z", "c": [147.5, 106.2] }] }, { "name": "জয়পুরহাট", "d": "M73.2778933680104 136.2628088426528L74.9 134.1L77.3 136.5L83.4 136.5L84.3 129.6L86.8 127.7L86.5 123.8L81.6 123.2L80.4 121.4L78.6 121.4L76.43766006984866 119.23766006984867L84.49082586881715 114.33638875025174L106.01635752748555 119.50422472386063L119.37874408370664 144.340074082282L90.46041546020064 171.30611047804078Z", "c": [96.2, 143.8], "subs": [{ "d": "M94.05762732135189 167.95174836279003L96.3843288091357 148.38553136209381L104.41367932565595 145.98152999997805L109.94300786882665 153.13879856957516Z", "c": [102.6, 154.9] }, { "d": "M81.27669776564514 138.29907147508501L94.2103155286335 132.53199328896554L109.0307986361054 135.54641109794335L104.41367932565595 145.98152999997805L96.3843288091357 148.38553136209381Z", "c": [98, 139.6] }, { "d": "M104.41367932565595 145.98152999997805L109.0307986361054 135.54641109794335L113.12704887972787 132.72043116389216L119.37874408370664 144.340074082282L109.94300786882665 153.13879856957516Z", "c": [113.5, 146.4] }, { "d": "M80.38137973760247 138.21557080257838L81.06278621424514 136.5L83.4 136.5L84.3 129.6L86.8 127.7L86.5 123.8L86.12531415030637 123.75412010003751L89.39800330545924 115.51450079357257L98.37009931966463 117.6685159080941L94.2103155286335 132.53199328896554L81.27669776564514 138.29907147508501Z", "c": [91.5, 125] }, { "d": "M94.2103155286335 132.53199328896554L98.37009931966463 117.6685159080941L106.01635752748555 119.50422472386063L113.12704887972787 132.72043116389216L109.0307986361054 135.54641109794335Z", "c": [100.4, 127.5] }, { "d": "M74.86499616262655 139.49966322640944L80.38137973760247 138.21557080257838L81.27669776564514 138.29907147508501L96.3843288091357 148.38553136209381L94.05762732135189 167.95174836279003L90.46041546020064 171.30611047804078Z", "c": [88.9, 153.2] }, { "d": "M73.2778933680104 136.2628088426528L74.9 134.1L77.3 136.5L81.06278621424514 136.5L80.38137973760247 138.21557080257838L74.86499616262655 139.49966322640944ZM76.43766006984866 119.23766006984867L84.49082586881715 114.33638875025174L89.39800330545924 115.51450079357257L86.12531415030637 123.75412010003751L81.6 123.2L80.4 121.4L78.6 121.4Z", "c": [81.4, 121] }] }, { "name": "নওগাঁ", "d": "M38.98474497681607 154.50653786707883L39.7 154.2L40 152.6L41.8 151.4L42.4 141.1L43 140.5L42.7 134.7L45.8 133.5L48.2 134.1L48.8 135.3L54.3 135.3L56.1 134.1L63.4 133.5L65.8 135.9L68.8 136.5L73.1 136.5L73.2778933680104 136.2628088426528L90.46041546020064 171.30611047804078L89.09533141996465 179.83387077645608L81.6546339031865 183.89632057009933L50.229453418397355 176.47429301841547Z", "c": [65.2, 159], "subs": [{ "d": "M71.031248361455 163.09368682122388L82.62612454879289 155.32828032977497L88.17906397616454 166.6533541619145L76.564387174058 169.89569045161306Z", "c": [80.8, 163.3] }, { "d": "M42.79673743127634 161.95367776522545L50.06606407544953 157.78368445684302L60.490096494754845 156.04400026045147L64.97002369570599 161.38208054117462L60.77328605801992 178.96454494837658L50.229453418397355 176.47429301841547Z", "c": [56, 169.5] }, { "d": "M60.77328605801992 178.96454494837658L64.97002369570599 161.38208054117462L71.031248361455 163.09368682122388L76.564387174058 169.89569045161306L76.46617402652568 172.017087909712L68.42381262131136 180.77145323216902Z", "c": [69.3, 172.7] }, { "d": "M58.14731885623414 133.93172721729582L63.4 133.5L65.8 135.9L68.8 136.5L73.1 136.5L73.2778933680104 136.2628088426528L77.38848261842726 144.64624744547666L63.37172753631182 148.99715505999552Z", "c": [69.7, 138.6] }, { "d": "M44.82824546602508 133.87616304540964L45.8 133.5L48.2 134.1L48.8 135.3L54.3 135.3L56.1 134.1L58.14731885623414 133.93172721729582L63.37172753631182 148.99715505999552L60.490096494754845 156.04400026045147L50.06606407544953 157.78368445684302Z", "c": [51.9, 144.7] }, { "d": "M60.490096494754845 156.04400026045147L63.37172753631182 148.99715505999552L77.38848261842726 144.64624744547666L82.62612454879289 155.32828032977497L71.031248361455 163.09368682122388L64.97002369570599 161.38208054117462Z", "c": [74.5, 154] }, { "d": "M76.46617402652568 172.017087909712L76.564387174058 169.89569045161306L88.17906397616453 166.6533541619145L90.46041546020064 171.30611047804078L89.09533141996465 179.83387077645608L84.83204974020533 182.16152456712928Z", "c": [83.6, 173.3] }, { "d": "M68.42381262131137 180.77145323216902L76.46617402652568 172.017087909712L84.83204974020533 182.16152456712928L81.6546339031865 183.89632057009933Z", "c": [76.4, 179.3] }, { "d": "M38.98474497681607 154.50653786707883L39.7 154.2L40 152.6L41.8 151.4L42.4 141.1L43 140.5L42.7 134.7L44.82824546602508 133.87616304540964L50.06606407544953 157.78368445684302L42.79673743127634 161.95367776522545Z", "c": [42.9, 146.7] }] }, { "name": "বগুড়া", "d": "M89.09533141996465 179.83387077645608L90.46041546020064 171.30611047804078L119.37874408370664 144.340074082282L136.81821372339274 149.80009495078184L139.90781113037994 181.56749393031689L109.95661454240314 191.57729331219946Z", "c": [118.3, 167.5], "subs": [{ "d": "M101.69355221123058 162.4932958891677L118.38886969416005 163.0928837880291L120.46801773667916 174.96969591425832L119.37678692027282 176.69308838848139L105.82364653181769 176.58236235640106L103.85684402365592 175.0160085727505Z", "c": [113, 170.8] }, { "d": "M100.84891416577467 161.61894501841266L119.37874408370664 144.340074082282L120.24260537519775 144.61053532774883L122.58010067302251 159.16938347644944L118.38886969416005 163.0928837880291L101.69355221123058 162.4932958891677Z", "c": [113.5, 155.1] }, { "d": "M89.09533141996465 179.83387077645608L90.46041546020064 171.30611047804078L100.84891416577467 161.61894501841266L101.69355221123058 162.4932958891677L103.85684402365592 175.0160085727505L93.73079837216297 182.44330983879198Z", "c": [93.8, 174.1] }, { "d": "M105.82364653181769 176.58236235640106L119.37678692027282 176.69308838848139L121.323677999738 187.77837915413454L109.95661454240314 191.57729331219946L108.8376003414392 190.94736769792684Z", "c": [112.9, 182.5] }, { "d": "M118.38886969416005 163.0928837880291L122.58010067302251 159.16938347644944L138.0857445699494 162.83291211665937L139.04857863128183 172.73282131138484L120.46801773667916 174.96969591425832Z", "c": [126.1, 168.5] }, { "d": "M120.24260537519775 144.61053532774883L136.81821372339274 149.80009495078184L138.0857445699494 162.83291211665937L122.58010067302251 159.16938347644944Z", "c": [129.9, 152.4] }, { "d": "M119.37678692027282 176.69308838848139L120.46801773667916 174.96969591425832L139.04857863128183 172.73282131138484L139.90781113037994 181.56749393031689L121.323677999738 187.77837915413454Z", "c": [127.5, 180] }, { "d": "M93.73079837216297 182.44330983879198L103.85684402365592 175.0160085727505L105.82364653181769 176.58236235640106L108.8376003414392 190.94736769792684Z", "c": [101.8, 184.8] }] }, { "name": "জামালপুর", "d": "M136.81821372339274 149.80009495078184L151.914889728036 139.43810910697786L183.94979150478156 168.44483608890667L177.46760696630773 184.1825109220055L153.06383363775927 190.0783805286926L139.90781113037994 181.56749393031689Z", "c": [158.4, 163.6], "subs": [{ "d": "M147.90617372225228 157.13782592657333L150.8391036106983 140.17650214895517L151.914889728036 139.43810910697786L168.90002785534807 154.81768691379773L162.56323095456898 167.33789169013724L160.49660348062466 168.33094574513788Z", "c": [158.5, 154.6] }, { "d": "M139.4730337760247 177.0970908765615L153.97898336999404 175.15766708895882L154.9187408464668 189.6302411820511L153.06383363775927 190.0783805286926L139.90781113037994 181.56749393031689Z", "c": [148.8, 184.1] }, { "d": "M170.16397962181657 169.95357465235938L182.39922286520851 167.04083861426838L183.94979150478156 168.44483608890667L177.98222950640962 182.93309228083027Z", "c": [177.8, 173.8] }, { "d": "M153.97898336999404 175.15766708895882L159.71836595412825 170.04791968405883L167.91563082771717 186.49023624960614L154.9187408464668 189.6302411820511Z", "c": [160.3, 183.3] }, { "d": "M162.56323095456898 167.33789169013724L168.90002785534807 154.81768691379773L182.39922286520851 167.04083861426838L170.16397962181657 169.95357465235938Z", "c": [175.3, 163.1] }, { "d": "M136.81821372339274 149.80009495078184L150.8391036106983 140.17650214895517L147.90617372225228 157.13782592657333L137.9799309754593 161.7449313117737Z", "c": [138.8, 151.2] }, { "d": "M137.9799309754593 161.7449313117737L147.90617372225228 157.13782592657333L160.49660348062466 168.33094574513788L159.71836595412825 170.04791968405883L153.97898336999404 175.15766708895882L139.4730337760247 177.0970908765615Z", "c": [146.6, 167.9] }, { "d": "M159.71836595412825 170.04791968405883L160.49660348062466 168.33094574513788L162.56323095456898 167.33789169013724L170.16397962181657 169.95357465235938L177.98222950640962 182.93309228083027L177.46760696630773 184.1825109220055L167.91563082771717 186.49023624960614Z", "c": [170, 178.5] }] }, { "name": "শেরপুর", "d": "M151.914889728036 139.43810910697786L157.32717533887188 126.5119588981198L157.5 126.8L161.7 126.8L163.6 125L164.2 125.6L167.8 125.6L169 127.4L171.5 127.4L173.9 129.3L175.1 129.3L180 132.9L185.4 132.9L189.1 134.7L198.2 135.3L201.8 138.4L204.9 139L210.3 139L211.1711024729137 138.58187081300142L206.40003989158873 152.01921131982493L183.94979150478156 168.44483608890667Z", "c": [176.6, 143.5], "subs": [{ "d": "M154.6824279484861 141.94403923693764L169.75094880434864 127.4L171.5 127.4L173.9 129.3L175.1 129.3L178.32674325405432 131.6706685131828L172.49422579205722 143.39042914893523L157.51247240982843 144.50656705765556Z", "c": [169.5, 136.1] }, { "d": "M179.49755570796881 150.19276354506096L193.69298786114757 135.00283436447125L198.2 135.3L199.74892279748204 136.6337946311651L195.97822218093592 151.13497926731515L181.07138327039308 163.34615544052681Z", "c": [188.3, 149] }, { "d": "M157.5124724098284 144.50656705765556L172.49422579205722 143.39042914893523L179.49755570796881 150.19276354506096L181.07138327039308 163.34615544052681L180.4696747488811 165.2936855935142Z", "c": [170.7, 151.1] }, { "d": "M195.97822218093592 151.13497926731515L199.74892279748204 136.6337946311651L201.8 138.4L204.9 139L210.3 139L211.1711024729137 138.58187081300142L206.40003989158873 152.01921131982493L200.45188409247132 156.37115315766022Z", "c": [203.7, 153] }, { "d": "M151.914889728036 139.43810910697786L157.32717533887188 126.5119588981198L157.5 126.8L161.7 126.8L163.6 125L164.2 125.6L167.8 125.6L169 127.4L169.75094880434864 127.4L154.6824279484861 141.94403923693764Z", "c": [161.1, 127.3] }, { "d": "M172.49422579205722 143.39042914893523L178.32674325405432 131.6706685131828L180 132.9L185.4 132.9L189.1 134.7L193.69298786114757 135.00283436447125L179.49755570796881 150.19276354506096Z", "c": [180.1, 141.3] }, { "d": "M180.4696747488811 165.2936855935142L181.07138327039308 163.34615544052681L195.97822218093592 151.13497926731515L200.45188409247132 156.37115315766022L183.94979150478156 168.44483608890667Z", "c": [196.6, 159.1] }] }, { "name": "চাঁপাইনবাবগঞ্জ", "d": "M6 182.4L7.5 179.7L10.3 178.1L11.5 172.7L13.9 172.1L13.9 169.6L16 169.3L16.3 167.2L18.8 165.4L18.8 161.1L16.9 159.3L17.2 158.4L21.5 156L22.7 156L26 159.9L26.3 162.7L32.4 163.3L33.3 158.1L37.6 157.5L37.6 155.1L38.98474497681607 154.50653786707883L50.229453418397355 176.47429301841547L29.665187611673616 205.20378201310302L26.9 202.1L23.9 200.9L21.5 200.9L13.3 192.7L9 184.8Z", "c": [27.3, 178.4], "subs": [{ "d": "M15.242115742535226 194.64211574253522L23.710236581371547 189.01543963536665L34.478763216746714 198.47893374130973L29.665187611673616 205.20378201310302L26.9 202.1L23.9 200.9L21.5 200.9Z", "c": [27.8, 198.5] }, { "d": "M16.943731800129555 159.16880459961135L17.2 158.4L21.5 156L22.7 156L26 159.9L26.3 162.7L32.4 163.3L33.3 158.1L37.6 157.5L37.6 155.1L38.98474497681607 154.50653786707883L47.22952605190968 170.61361017357615L35.555677180673854 171.5471140962374Z", "c": [36.3, 160.6] }, { "d": "M23.710236581371547 189.01543963536665L25.308588002460198 186.35572910191323L29.57788596700502 184.18206886950173L40.97758593356701 189.39969612222257L34.478763216746714 198.47893374130973Z", "c": [33.6, 191.8] }, { "d": "M29.57788596700502 184.18206886950173L35.555677180673854 171.5471140962374L47.22952605190968 170.61361017357615L50.229453418397355 176.47429301841547L40.97758593356701 189.39969612222257Z", "c": [38, 182.2] }, { "d": "M10.924547645208587 175.28953559656134L11.5 172.7L13.9 172.1L13.9 169.6L15.704544126256636 169.34220798196336L25.308588002460198 186.35572910191323L23.710236581371547 189.01543963536665L15.242115742535228 194.64211574253522L14.617776448614297 194.01777644861428Z", "c": [16.6, 181.6] }, { "d": "M15.704544126256636 169.34220798196336L16 169.3L16.3 167.2L18.8 165.4L18.8 161.1L16.9 159.3L16.943731800129555 159.16880459961135L35.555677180673854 171.5471140962374L29.57788596700502 184.18206886950173L25.308588002460198 186.35572910191323Z", "c": [25.8, 176.4] }, { "d": "M6 182.4L7.5 179.7L10.3 178.1L10.924547645208587 175.28953559656134L14.617776448614297 194.01777644861428L13.3 192.7L9 184.8Z", "c": [8.1, 183.3] }] }, { "name": "রাজশাহী", "d": "M29.665187611673616 205.20378201310302L50.229453418397355 176.47429301841547L81.6546339031865 183.89632057009933L66.7255828332661 229.52624279187222L66.03448572596433 229.60290966589935L65.5 223.1L66.1 222.5L66.1 218.8L64.9 215.8L62.8 214.3L57.9 214.3L57.3 214.9L56.7 214.3L50 214.3L48.2 211.2L46.4 211.2L41.5 208.2L33 208.2L31.8 207.6Z", "c": [55.8, 198.8], "subs": [{ "d": "M52.12223827898731 199.28237467333864L55.5693836715942 191.7102873149546L77.30328337414807 197.19601291288615L76.71033321351635 199.00833638772022L61.28943672761626 208.27032688426382L52.65426156171158 201.02394360245265Z", "c": [61.6, 198.9] }, { "d": "M40.7894009184249 189.66260165808285L50.229453418397355 176.47429301841547L52.6284244881358 177.04088417558987L55.5693836715942 191.7102873149546L52.12223827898731 199.28237467333864L43.642801497766534 197.83006196016905Z", "c": [46.2, 191.9] }, { "d": "M45.56347548506443 210.6878421337129L52.65426156171158 201.02394360245265L61.28943672761626 208.27032688426382L60.548500430764705 214.3L57.9 214.3L57.3 214.9L56.7 214.3L50 214.3L48.2 211.2L46.4 211.2Z", "c": [52.1, 210.2] }, { "d": "M52.6284244881358 177.04088417558987L81.6546339031865 183.89632057009933L77.30328337414807 197.19601291288615L55.5693836715942 191.7102873149546Z", "c": [64.3, 188.2] }, { "d": "M30.537567782166676 206.1829842452891L43.642801497766534 197.83006196016905L52.12223827898731 199.28237467333864L52.65426156171158 201.02394360245265L45.56347548506443 210.6878421337129L41.5 208.2L33 208.2L31.8 207.6Z", "c": [44, 204.3] }, { "d": "M60.548500430764705 214.3L61.28943672761626 208.27032688426382L76.71033321351635 199.00833638772022L66.7255828332661 229.52624279187222L66.03448572596433 229.60290966589935L65.5 223.1L66.1 222.5L66.1 218.8L64.9 215.8L62.8 214.3Z", "c": [69.7, 212.4] }, { "d": "M29.665187611673616 205.20378201310302L40.7894009184249 189.66260165808285L43.642801497766534 197.83006196016905L30.537567782166676 206.1829842452891Z", "c": [38, 194.7] }] }, { "name": "নাটোর", "d": "M66.7255828332661 229.52624279187222L81.6546339031865 183.89632057009933L89.09533141996465 179.83387077645608L109.95661454240314 191.57729331219946L113.4173469387755 215.54606953892667L95.08157894736841 232.75L72.01504854368935 232.75Z", "c": [93.7, 211.2], "subs": [{ "d": "M90.1019360831446 199.92814856093884L95.49965935596026 193.9692846395648L110.0913966565102 192.5107842506446L111.91971099564016 205.17355393276702L103.33909529094272 210.64061608092769L96.66393640965848 210.9816606290447Z", "c": [99.3, 202.1] }, { "d": "M69.81518498124638 231.40925475188388L82.70672040529178 224.4613335784904L97.43488582953447 230.5419589747578L95.08157894736841 232.75L72.01504854368935 232.75Z", "c": [88.4, 232] }, { "d": "M75.58042958934563 202.46183214224197L76.25460895603607 200.40123552953492L90.1019360831446 199.92814856093884L96.66393640965848 210.9816606290447L93.27025824355515 215.02379319532446L87.32243386974407 216.86942378725152Z", "c": [87.6, 209] }, { "d": "M88.06244199234435 180.39780465935223L89.09533141996465 179.83387077645608L109.95661454240314 191.57729331219946L110.0913966565102 192.5107842506446L95.49965935596026 193.9692846395648Z", "c": [97.6, 185.2] }, { "d": "M82.70672040529178 224.4613335784904L87.32243386974407 216.86942378725152L93.27025824355515 215.02379319532446L99.37629313997168 228.72039162175497L97.43488582953447 230.5419589747578Z", "c": [92, 223.2] }, { "d": "M76.25460895603607 200.40123552953492L81.6546339031865 183.89632057009933L88.06244199234435 180.39780465935223L95.49965935596026 193.9692846395648L90.1019360831446 199.92814856093884Z", "c": [87, 191] }, { "d": "M103.33909529094272 210.64061608092769L111.91971099564016 205.17355393276702L113.4173469387755 215.54606953892667L105.4911604242388 222.98298528096112Z", "c": [109.3, 217.9] }, { "d": "M66.7255828332661 229.52624279187222L75.58042958934564 202.46183214224197L87.32243386974407 216.86942378725152L82.70672040529178 224.4613335784904L69.81518498124638 231.40925475188388Z", "c": [79.6, 215.6] }, { "d": "M93.27025824355515 215.02379319532446L96.66393640965848 210.9816606290447L103.33909529094272 210.64061608092769L105.4911604242388 222.98298528096112L99.37629313997166 228.72039162175497Z", "c": [100.2, 219.5] }] }, { "name": "সিরাজগঞ্জ", "d": "M109.95661454240314 191.57729331219946L139.90781113037994 181.56749393031689L153.06383363775927 190.0783805286926L147.2075657894737 232.1567495126706L113.4173469387755 215.54606953892667Z", "c": [131.1, 205.8], "subs": [{ "d": "M130.67133176506593 224.02782638956103L131.89534977151501 222.00514624605933L141.53257857688783 217.68880559876277L148.98945967688647 219.35351195126037L147.2075657894737 232.1567495126706Z", "c": [139.3, 225.2] }, { "d": "M109.95661454240314 191.57729331219946L131.46536656392558 184.38898976453663L122.77112438711838 205.86805537200797L112.5655325937696 209.64646648277466Z", "c": [117.7, 195.6] }, { "d": "M122.77112438711838 205.86805537200797L131.46536656392558 184.38898976453663L131.9107243198029 184.24014957458286L140.21849065808232 195.33354250253714L140.09902777616816 203.67446420318444L136.3733837405863 208.0021975732126L127.96065244167582 208.62067396767537Z", "c": [133.5, 202] }, { "d": "M140.09902777616816 203.67446420318444L140.21849065808232 195.33354250253714L152.0726397810223 197.20029194376576L150.4269536140424 209.0248518102141Z", "c": [146.7, 202.2] }, { "d": "M127.96065244167582 208.62067396767537L136.3733837405863 208.0021975732126L141.53257857688783 217.68880559876277L131.89534977151501 222.00514624605933Z", "c": [134.4, 214.3] }, { "d": "M131.9107243198029 184.24014957458283L139.90781113037994 181.56749393031689L153.06383363775927 190.0783805286926L152.0726397810223 197.20029194376576L140.21849065808232 195.33354250253714Z", "c": [148.5, 190.8] }, { "d": "M136.3733837405863 208.0021975732126L140.09902777616816 203.67446420318444L150.4269536140424 209.0248518102141L148.98945967688647 219.35351195126037L141.53257857688783 217.68880559876277Z", "c": [142.7, 209.9] }, { "d": "M112.5655325937696 209.64646648277466L122.77112438711838 205.86805537200797L127.96065244167582 208.62067396767537L131.89534977151501 222.00514624605933L130.67133176506593 224.02782638956103L113.4173469387755 215.54606953892667Z", "c": [125.6, 216.9] }] }, { "name": "ময়মনসিংহ", "d": "M177.46760696630773 184.1825109220055L183.94979150478156 168.44483608890667L206.40003989158873 152.01921131982493L230.50309803972445 189.71229161531375L221.40850178359096 206.17987331366245L196.4772718380123 208.18052756855457Z", "c": [205.5, 183], "subs": [{ "d": "M177.46760696630773 184.1825109220055L183.94979150478156 168.44483608890667L187.27671887610265 166.01070441723124L190.8206253253297 175.72302052776186L187.90919034827368 181.71643772628124L179.94904824749614 187.3151105535767Z", "c": [182.2, 175.2] }, { "d": "M187.27671887610265 166.01070441723124L204.30537856821735 153.55176099692451L206.5997369376315 176.1917685628666L206.41288201682468 176.30358631755L190.8206253253297 175.72302052776186Z", "c": [197.1, 169.7] }, { "d": "M207.89550839275765 207.2642493265071L209.03983208559197 198.95952530986617L223.65631291550585 191.19916331593703L228.8133151837911 192.77198073716835L221.40850178359096 206.17987331366245Z", "c": [220, 198.1] }, { "d": "M200.59016487361413 188.18880925495935L206.41288201682468 176.30358631755L206.5997369376315 176.1917685628666L214.4365412998712 178.91649349144765L214.79084092436995 180.31111077163627L208.77756492042113 198.02022738682282Z", "c": [207.8, 187.6] }, { "d": "M179.94904824749614 187.3151105535767L187.90919034827368 181.71643772628124L198.77487462252125 188.4888351184475L189.33339144535356 199.16201189555272Z", "c": [192.1, 189.3] }, { "d": "M214.4365412998712 178.91649349144765L220.95760032889726 174.78475796114782L230.50309803972445 189.71229161531375L228.8133151837911 192.77198073716835L223.65631291550585 191.19916331593703L214.79084092436995 180.31111077163627Z", "c": [224.4, 183.4] }, { "d": "M204.30537856821735 153.5517609969245L206.40003989158873 152.01921131982493L220.95760032889726 174.78475796114782L214.4365412998712 178.91649349144765L206.5997369376315 176.1917685628666Z", "c": [214.6, 167.9] }, { "d": "M208.77756492042113 198.02022738682282L214.79084092436995 180.31111077163627L223.65631291550585 191.19916331593703L209.03983208559197 198.95952530986617Z", "c": [215.9, 190.4] }, { "d": "M189.33339144535356 199.16201189555272L198.77487462252125 188.4888351184475L200.59016487361413 188.18880925495935L208.77756492042113 198.02022738682282L209.03983208559197 198.95952530986617L207.89550839275765 207.2642493265071L196.4772718380123 208.18052756855457Z", "c": [198.8, 195.2] }, { "d": "M187.90919034827368 181.71643772628124L190.8206253253297 175.72302052776186L206.41288201682468 176.30358631755L200.59016487361413 188.18880925495935L198.77487462252125 188.4888351184475Z", "c": [196.6, 182.2] }] }, { "name": "নেত্রকোনা", "d": "M206.40003989158873 152.01921131982493L211.1711024729137 138.58187081300142L212.8 137.8L221.3 137.2L221.9 136.5L225.5 136.5L226.1 137.8L227.9 138.4L232.8 138.4L235.2 136.5L236.4 136.5L238.9 138.4L243.7 138.4L244.3 137.8L249.8 137.8L251 136.5L256.02486211973746 136.11836490229842L262.995239860818 178.7056728081684L230.50309803972445 189.71229161531375Z", "c": [234.9, 164.2], "subs": [{ "d": "M222.40633370441137 152.5796703081587L222.62869605193623 149.11263241918462L228.47008751025504 140.34375622412122L243.88638719042464 156.59041416713785L243.88926697797262 158.4909154152575L242.2263897187683 161.29534249432473L226.5327725280487 165.80193592247142Z", "c": [234.2, 156.9] }, { "d": "M211.4368958763106 159.895996742741L222.40633370441137 152.5796703081587L226.5327725280487 165.80193592247142L222.99908255583117 177.97728867773597Z", "c": [215.2, 162.8] }, { "d": "M242.2263897187683 161.29534249432473L243.88926697797262 158.4909154152575L260.59326148866813 164.9353704851955L252.0346271876974 173.99310682186228L244.257240117137 169.36962272894885Z", "c": [250, 166.3] }, { "d": "M243.07285139666584 185.45432412085103L252.03606238025307 174.07014623668388L257.4420179446871 180.58681062662572Z", "c": [252.1, 182.1] }, { "d": "M227.89537838636127 185.63426194462875L244.257240117137 169.36962272894885L252.0346271876974 173.99310682186228L252.03606238025307 174.07014623668388L243.07285139666584 185.45432412085103L230.50309803972445 189.71229161531375Z", "c": [244.3, 175.9] }, { "d": "M243.88638719042464 156.59041416713785L257.38806742986156 144.44721685805658L260.73374591530757 164.8884963849888L260.59326148866813 164.9353704851955L243.88926697797262 158.4909154152575Z", "c": [253.6, 156.8] }, { "d": "M207.74737005393732 148.2245568046113L211.1711024729137 138.58187081300142L212.8 137.8L221.3 137.2L221.9 136.5L225.5 136.5L226.1 137.8L227.9 138.4L228.78352402677794 138.4L228.47008751025504 140.34375622412122L222.62869605193623 149.11263241918462Z", "c": [211, 141.5] }, { "d": "M228.47008751025504 140.34375622412122L228.78352402677794 138.4L232.8 138.4L235.2 136.5L236.4 136.5L238.9 138.4L243.7 138.4L244.3 137.8L249.8 137.8L251 136.5L256.02486211973746 136.11836490229842L257.38806742986156 144.44721685805658L243.88638719042464 156.59041416713785Z", "c": [244.7, 146.9] }, { "d": "M252.0346271876974 173.99310682186228L260.59326148866813 164.9353704851955L260.73374591530757 164.8884963849888L262.995239860818 178.7056728081684L257.4420179446871 180.58681062662572L252.03606238025307 174.07014623668388Z", "c": [259.9, 175.6] }, { "d": "M222.99908255583117 177.97728867773597L226.5327725280487 165.80193592247142L242.2263897187683 161.29534249432473L244.257240117137 169.36962272894885L227.89537838636124 185.63426194462875Z", "c": [237.7, 169.3] }, { "d": "M206.40003989158873 152.01921131982493L207.74737005393732 148.2245568046113L222.62869605193623 149.11263241918462L222.40633370441137 152.5796703081587L211.4368958763106 159.895996742741Z", "c": [210.2, 155.3] }] }, { "name": "সুনামগঞ্জ", "d": "M256.02486211973746 136.11836490229842L258.9 135.9L260.7 134.7L268.6 135.3L269.2 134.7L277.1 134.7L281.4 137.2L288 137.8L289.9 139L291.7 139L292.3 140.2L299 139.6L302 137.8L302.6 136.5L302.9 138.7L305 139.6L305.7 140.8L309.3 140.8L309.69554937413074 140.58025034770515L308.8629720465694 174.29963211394124L302.1443308978994 180.78280686721394L269.6192725807633 183.2895550997485L262.995239860818 178.7056728081684Z", "c": [285, 156], "subs": [{ "d": "M271.1402199981201 155.5683489244866L284.1593568790439 149.59689478013343L284.8898482930518 150.69888410235126L287.1108152875116 169.65179653940697L279.5888503240332 168.05370484387376Z", "c": [281.4, 160.2] }, { "d": "M284.8898482930518 150.69888410235126L296.53374214214233 157.3795001798722L297.5165584392835 161.43388409703564L292.3450516435852 173.5096277571638L287.1108152875116 169.65179653940697Z", "c": [290.5, 159.2] }, { "d": "M284.1593568790439 149.59689478013343L284.5473662943007 148.36192579291642L299.2347124512794 142.5779712481385L302.1736783220097 148.58672028217603L296.53374214214233 157.3795001798722L284.8898482930518 150.69888410235126Z", "c": [295, 151.2] }, { "d": "M299.2347124512794 142.5779712481385L300.35345440414983 138.7879273575101L302 137.8L302.6 136.5L302.9 138.7L305 139.6L305.7 140.8L309.3 140.8L309.69554937413074 140.58025034770515L309.4073728508293 152.25139954141324L302.1736783220097 148.58672028217603Z", "c": [308.7, 144.6] }, { "d": "M263.7955809180729 179.25951506026487L279.5888503240332 168.05370484387376L287.1108152875116 169.65179653940697L292.3450516435852 173.5096277571638L295.63297048372056 181.28464582013717L269.6192725807633 183.2895550997485Z", "c": [278.1, 175.9] }, { "d": "M296.53374214214233 157.3795001798722L302.1736783220097 148.58672028217603L309.4073728508293 152.25139954141324L309.22223831735084 159.74934814729167L297.5165584392835 161.43388409703564Z", "c": [302.8, 156.2] }, { "d": "M256.02486211973746 136.11836490229842L258.9 135.9L260.7 134.7L268.6 135.3L269.2 134.7L277.1 134.7L280.42628925836794 136.6338891037023L284.5473662943007 148.36192579291642L284.1593568790439 149.59689478013343L271.1402199981201 155.5683489244866L269.8156563364608 155.40808976436307L257.5728603078161 145.57625627092506Z", "c": [274.3, 144.7] }, { "d": "M280.42628925836794 136.6338891037023L281.4 137.2L288 137.8L289.9 139L291.7 139L292.3 140.2L299 139.6L300.35345440414983 138.7879273575101L299.2347124512794 142.5779712481385L284.5473662943007 148.36192579291642Z", "c": [290.3, 139.1] }, { "d": "M262.1618088915924 173.61361286204598L269.8156563364608 155.40808976436307L271.1402199981201 155.5683489244866L279.5888503240332 168.05370484387376L263.7955809180729 179.25951506026487L262.995239860818 178.7056728081684Z", "c": [271.6, 166.9] }, { "d": "M257.5728603078161 145.57625627092506L269.8156563364608 155.40808976436307L262.1618088915924 173.61361286204598Z", "c": [260.4, 162.1] }, { "d": "M292.3450516435852 173.5096277571638L297.5165584392835 161.43388409703564L309.22223831735084 159.74934814729167L308.8629720465694 174.29963211394124L302.1443308978994 180.78280686721394L295.63297048372056 181.28464582013717Z", "c": [304, 165] }] }, { "name": "সিলেট", "d": "M308.8629720465694 174.29963211394124L309.69554937413074 140.58025034770515L312 139.3L312.3 137.8L316 137.8L316.6 136.5L343.3 134.7L346.9 136.5L348.2 139L351.8 140.8L353.6 140.8L356.1 143.2L359.7 144.4L364.6 144.4L365.2 146.9L367 146.9L371.2 148.7L371.5 153.2L374.9 156.6L377 156.9L377.3 161.4L374.3 161.4L373.1 162.7L370.6 163.3L366.4 160.2L364.6 160.2L362.7 158.4L357 158.7L357 165.4L360 167.8L360.6 175.7L358.2 179.4L357.6 181.8L357.45338358458963 182.8263149078727Z", "c": [333.6, 157.2], "subs": [{ "d": "M319.8991054940699 168.25566151238746L320.0068756052216 159.77029299107636L331.0112816113359 156.64600710028498L331.2400670708437 175.98860181604473Z", "c": [326.3, 164.2] }, { "d": "M334.8443829387713 142.282376250977L336.1186175112245 135.1841381453107L343.3 134.7L346.9 136.5L348.2 139L351.8 140.8L352.39881381190276 140.8L345.91514617490077 148.1630082674631Z", "c": [345.7, 140.8] }, { "d": "M331.0112816113359 156.64600710028498L331.4707071406364 156.13049724939833L349.4135222125108 161.8308498378402L338.8404345293473 179.56010029000564L332.928915494116 178.52274238238093L331.2400670708437 175.98860181604473Z", "c": [335.9, 164.1] }, { "d": "M356.05601462530984 161.06219695484097L361.5249668801903 144.4L364.6 144.4L365.2 146.9L367 146.9L371.2 148.7L371.5 153.2L374.9 156.6L377 156.9L377.3 161.4L374.3 161.4L373.1 162.7L370.6 163.3L366.4 160.2L364.6 160.2L362.7 158.4L357 158.7L357 161.57465700644116Z", "c": [366.4, 151.7] }, { "d": "M309.39692932990926 152.67436213867555L309.69554937413074 140.58025034770515L312 139.3L312.3 137.8L316 137.8L316.6 136.5L318.39818263413275 136.3787742044405L324.2912533622022 144.89163596282918L311.8825720000365 153.03660026453085Z", "c": [316.7, 143] }, { "d": "M318.39818263413275 136.3787742044405L336.1186175112245 135.1841381453107L334.8443829387713 142.282376250977L331.15816563145296 145.8287816039835L324.2912533622022 144.89163596282918Z", "c": [325.2, 137.1] }, { "d": "M338.8404345293473 179.56010029000564L349.4135222125108 161.8308498378402L350.4624148899829 161.17566181011574L356.05601462530984 161.06219695484097L357 161.57465700644116L357 165.4L360 167.8L360.6 175.7L358.2 179.4L357.6 181.8L357.45338358458963 182.8263149078727Z", "c": [353.8, 174.8] }, { "d": "M308.89765796397126 172.8948524591653L309.39692932990926 152.67436213867555L311.8825720000365 153.03660026453085L320.0068756052216 159.77029299107636L319.8991054940699 168.25566151238746Z", "c": [313.6, 164.1] }, { "d": "M331.15816563145296 145.8287816039835L334.8443829387713 142.282376250977L345.91514617490077 148.1630082674631L350.4624148899829 161.17566181011574L349.4135222125108 161.8308498378402L331.4707071406364 156.13049724939833Z", "c": [339.7, 152.2] }, { "d": "M345.91514617490077 148.1630082674631L352.39881381190276 140.8L353.6 140.8L356.1 143.2L359.7 144.4L361.5249668801903 144.4L356.05601462530984 161.06219695484097L350.4624148899829 161.17566181011574Z", "c": [353.3, 147.4] }, { "d": "M311.8825720000365 153.03660026453085L324.2912533622022 144.89163596282918L331.15816563145296 145.8287816039835L331.4707071406364 156.13049724939833L331.0112816113359 156.64600710028498L320.0068756052216 159.77029299107636Z", "c": [323, 152.7] }, { "d": "M308.8629720465694 174.29963211394124L308.89765796397126 172.8948524591653L319.8991054940699 168.25566151238746L331.2400670708437 175.98860181604473L332.928915494116 178.52274238238093Z", "c": [318.5, 175.7] }] }, { "name": "মৌলভীবাজার", "d": "M302.1443308978994 180.78280686721394L308.8629720465694 174.29963211394124L357.45338358458963 182.8263149078727L355.7 195.1L354.8 195.4L353.6 194.2L349.7 194.5L350.3 202.4L348.5 203.6L346.9 207L340.3 207.6L339.7 207L335.4 207L335.1 209.7L333 210L331.5 211.5L332.1 219.4L329.6 229.1L328.4 229.1L327.8 226.7L326 224.9L325.7 222.8L317.2 222.2L316.6 229.4L313.71024234428165 228.190334004583Z", "c": [326.3, 198.8], "subs": [{ "d": "M305.742061246658 195.52954774729034L315.9969433395259 185.9841654045506L326.89218023690506 197.13641684586145L327.08444676137987 198.1386887301688L318.2720257579689 210.68277363283462L309.4186671552723 210.5995917463358Z", "c": [314.1, 194.3] }, { "d": "M315.83075457049193 185.03274100956065L324.367019546347 177.0202942953926L334.3857312373977 178.77838552963948L326.89218023690506 197.13641684586145L315.9969433395259 185.9841654045506Z", "c": [324.3, 184.3] }, { "d": "M318.2720257579689 210.68277363283462L327.08444676137987 198.1386887301688L337.8932109220367 199.59080926381412L344.90152343492156 207.1816796877344L340.3 207.6L339.7 207L335.4 207L335.1 209.7L333 210L331.5 211.5L332.1 219.4L330.59211207549504 225.25060514707926Z", "c": [335.1, 209] }, { "d": "M309.41866715527226 210.5995917463358L318.2720257579689 210.68277363283462L330.59211207549504 225.25060514707926L329.6 229.1L328.4 229.1L327.8 226.7L326 224.9L325.7 222.8L317.2 222.2L316.6 229.4L313.71024234428165 228.190334004583Z", "c": [313.8, 227] }, { "d": "M302.1443308978994 180.78280686721394L306.42536669048883 176.65180737576662L315.83075457049193 185.03274100956065L315.9969433395259 185.9841654045506L305.742061246658 195.52954774729034Z", "c": [307.6, 187.2] }, { "d": "M326.89218023690506 197.13641684586145L334.3857312373977 178.77838552963948L343.713343878436 180.41520217097553L346.85153144621444 188.29899868720656L337.8932109220367 199.59080926381412L327.08444676137987 198.1386887301688Z", "c": [337.7, 189.8] }, { "d": "M343.713343878436 180.41520217097553L357.45338358458963 182.8263149078727L356.03664718526136 192.7434697031704L346.85153144621444 188.29899868720656Z", "c": [354.5, 183.1] }, { "d": "M306.42536669048883 176.65180737576662L308.8629720465694 174.29963211394124L324.367019546347 177.0202942953926L315.83075457049193 185.03274100956065Z", "c": [317.1, 176.6] }, { "d": "M337.8932109220367 199.59080926381412L346.85153144621444 188.29899868720656L356.03664718526136 192.7434697031704L355.7 195.1L354.8 195.4L353.6 194.2L349.7 194.5L350.3 202.4L348.5 203.6L346.9 207L344.90152343492156 207.1816796877344Z", "c": [347.5, 197.6] }] }, { "name": "হবিগঞ্জ", "d": "M269.00191350786486 223.93236073223042L269.6192725807633 183.2895550997485L302.1443308978994 180.78280686721394L313.71024234428165 228.190334004583L312.3 227.6L311.7 226.4L308.1 226.4L307.2 227.9L307.2 232.8L306.3 233.7L303.8 233.7L303.2 234.9L301.4 235.5L297.8 234.9L295.9 233.7L292.3 233.7L289.9 232.5L285.6 232.5L285.51181397006417 233.6464183891661Z", "c": [289, 207.9], "subs": [{ "d": "M277.725594805337 229.06518047868497L280.9945480894535 225.66380113022004L291.1887813303654 224.80331859183215L292.5043681503809 226.21001229022391L293.70229463945446 233.7L292.3 233.7L289.9 232.5L285.6 232.5L285.51181397006417 233.6464183891661Z", "c": [285.6, 230.4] }, { "d": "M290.6914575405876 213.8530890729251L293.361431762377 210.11670217530178L303.35899710277107 216.02384978457448L302.7657177005921 222.33546853451242L292.5043681503809 226.21001229022391L291.1887813303654 224.80331859183215Z", "c": [297.2, 219.6] }, { "d": "M279.5397413059631 182.52497176832657L302.1443308978994 180.78280686721394L307.16228100684486 201.35088808300128L293.27687544234436 207.83038063928768L281.42414828228965 189.45154386576223Z", "c": [299.1, 199.3] }, { "d": "M302.7657177005921 222.33546853451242L303.35899710277107 216.02384978457448L310.02448247324315 213.0827688188978L313.71024234428165 228.190334004583L312.3 227.6L311.7 226.4L308.1 226.4L307.36587215330485 227.62354641115857Z", "c": [308.8, 220.7] }, { "d": "M269.12867176435776 215.58744217978105L269.6192725807633 183.2895550997485L279.5397413059631 182.52497176832657L281.42414828228965 189.45154386576223L276.02742534282294 213.24235896397417Z", "c": [271.2, 206.9] }, { "d": "M279.81560733933196 215.54677668328196L290.6914575405876 213.8530890729251L291.1887813303654 224.80331859183215L280.9945480894535 225.66380113022004Z", "c": [284.8, 220.2] }, { "d": "M293.27687544234436 207.83038063928768L307.16228100684486 201.35088808300128L310.0244824732432 213.0827688188978L303.35899710277107 216.02384978457448L293.361431762377 210.11670217530178Z", "c": [303.5, 208.9] }, { "d": "M292.5043681503809 226.21001229022391L302.7657177005921 222.33546853451242L307.36587215330485 227.62354641115857L307.2 227.9L307.2 232.8L306.3 233.7L303.8 233.7L303.2 234.9L301.4 235.5L297.8 234.9L295.9 233.7L293.70229463945446 233.7Z", "c": [300.3, 228.1] }, { "d": "M269.00191350786486 223.93236073223042L269.12867176435776 215.58744217978105L276.02742534282294 213.24235896397417L279.81560733933196 215.54677668328196L280.9945480894535 225.66380113022004L277.725594805337 229.06518047868497Z", "c": [276.1, 221.2] }, { "d": "M276.02742534282294 213.24235896397417L281.42414828228965 189.45154386576223L293.27687544234436 207.83038063928768L293.361431762377 210.11670217530178L290.6914575405876 213.8530890729251L279.81560733933196 215.54677668328196Z", "c": [283.1, 209.6] }] }, { "name": "কিশোরগঞ্জ", "d": "M221.40850178359096 206.17987331366245L230.50309803972445 189.71229161531375L262.995239860818 178.7056728081684L269.6192725807633 183.2895550997485L269.00191350786486 223.93236073223042L256.52466534155445 228.45871328898264L229.51814083061473 219.56244639126135Z", "c": [249.5, 207.3], "subs": [{ "d": "M237.25152012014786 187.42628320756012L262.995239860818 178.7056728081684L263.1650024513031 178.82314984446901L250.49696629049046 193.7536566752682L237.59684552874097 187.75673915309147Z", "c": [253.4, 182] }, { "d": "M233.34754532336882 220.8238972829921L238.23109266525745 212.67738665837268L252.62159127931898 205.0678354335362L257.306423585904 213.0656004462349L245.8688968866298 224.94857779794864Z", "c": [248.7, 213.5] }, { "d": "M250.49696629049046 193.7536566752682L263.1650024513031 178.82314984446901L269.6192725807633 183.2895550997485L269.50080698726833 191.08854000483686L260.0674965349028 197.3811982286802L253.52164350950468 197.50540263605384Z", "c": [261.6, 188.9] }, { "d": "M252.62159127931898 205.0678354335362L253.52164350950468 197.50540263605384L260.0674965349028 197.3811982286802L268.1748805860572 205.49476720937943L260.46847158752223 214.00049864850172L257.306423585904 213.0656004462349Z", "c": [261.9, 205.8] }, { "d": "M260.0674965349028 197.3811982286802L269.5008069872683 191.08854000483686L269.2820753932523 205.4883699442235L268.1748805860572 205.49476720937943Z", "c": [268.5, 199.2] }, { "d": "M221.40850178359096 206.17987331366245L230.50309803972445 189.71229161531375L237.25152012014786 187.42628320756012L237.59684552874097 187.75673915309147L238.23109266525745 212.67738665837268L233.34754532336882 220.8238972829921L229.51814083061473 219.56244639126135Z", "c": [232.6, 203.8] }, { "d": "M245.8688968866298 224.94857779794864L257.306423585904 213.0656004462349L260.46847158752223 214.00049864850172L269.0048876754955 223.73656136321213L269.00191350786486 223.93236073223042L256.52466534155445 228.45871328898264Z", "c": [257.2, 221.7] }, { "d": "M260.46847158752223 214.00049864850172L268.1748805860572 205.49476720937943L269.2820753932523 205.48836994422354L269.0048876754955 223.73656136321213Z", "c": [268.5, 211.8] }, { "d": "M237.59684552874097 187.75673915309147L250.49696629049046 193.7536566752682L253.52164350950468 197.50540263605384L252.62159127931898 205.0678354335362L238.23109266525745 212.67738665837268Z", "c": [243.4, 203.6] }] }, { "name": "টাঙ্গাইল", "d": "M147.2075657894737 232.1567495126706L153.06383363775927 190.0783805286926L177.46760696630773 184.1825109220055L196.4772718380123 208.18052756855457L182.2487737126317 235.73080580152197L147.73351506191094 233.31253927185364Z", "c": [169.9, 211.2], "subs": [{ "d": "M153.815684876854 189.89673579655837L158.96069691228647 188.653718182956L174.87866498063124 197.19863522919695L165.62544143001853 208.33090604205688L160.4955854675776 206.7907641167518Z", "c": [164.4, 200.5] }, { "d": "M177.9500682544084 217.28319831698678L183.61705380600273 197.88762062828252L193.62870662033208 213.6961317890629L185.68901706119615 229.06955029817414L180.6819878365763 224.37962677314636Z", "c": [186.6, 211.9] }, { "d": "M147.2075657894737 232.1567495126706L149.1027573520832 218.5394471739209L161.88696491494838 220.1531959830317L165.45879292650417 225.2256712843168L160.37717046476465 234.198400478423L147.73351506191094 233.31253927185364Z", "c": [158.8, 225.5] }, { "d": "M149.1027573520832 218.5394471739209L149.62219364414776 214.80720122353102L160.4955854675776 206.7907641167518L165.62544143001853 208.33090604205688L167.18948870665506 211.75963705599176L161.88696491494838 220.1531959830317Z", "c": [160.3, 214.2] }, { "d": "M161.88696491494838 220.1531959830317L167.18948870665506 211.75963705599176L177.9500682544084 217.28319831698678L180.6819878365763 224.37962677314636L165.45879292650417 225.2256712843168Z", "c": [168, 219.1] }, { "d": "M149.62219364414776 214.80720122353102L153.06383363775927 190.0783805286926L153.815684876854 189.89673579655837L160.4955854675776 206.7907641167518Z", "c": [153.3, 204.8] }, { "d": "M165.62544143001853 208.33090604205688L174.87866498063124 197.19863522919695L183.5137229490631 196.4818024107861L183.61705380600273 197.88762062828252L177.9500682544084 217.28319831698678L167.18948870665506 211.75963705599176Z", "c": [173.6, 208.1] }, { "d": "M160.37717046476465 234.198400478423L165.45879292650417 225.2256712843168L180.6819878365763 224.37962677314636L185.68901706119615 229.06955029817414L182.2487737126317 235.73080580152197Z", "c": [168.6, 231.1] }, { "d": "M158.96069691228647 188.653718182956L177.46760696630773 184.1825109220055L185.43434992071457 194.2398176304056L183.5137229490631 196.4818024107861L174.87866498063124 197.19863522919695Z", "c": [171.8, 186.6] }, { "d": "M183.5137229490631 196.4818024107861L185.43434992071457 194.2398176304056L196.4772718380123 208.18052756855457L193.62870662033208 213.6961317890629L183.61705380600273 197.88762062828252Z", "c": [195, 206.5] }] }, { "name": "পাবনা", "d": "M95.08157894736841 232.75L113.4173469387755 215.54606953892667L147.2075657894737 232.1567495126706L147.73351506191094 233.31253927185364L143.93551064818212 241.65815423359984L115.24024517669888 257.1977441504646Z", "c": [116.5, 235.5], "subs": [{ "d": "M104.60037100902996 223.81878769523112L113.4173469387755 215.54606953892667L125.90275027846057 221.68367522106143L124.21819411935533 232.88728875536825L105.80912664146891 225.74048282655937Z", "c": [115.3, 224.4] }, { "d": "M95.08157894736841 232.75L104.60037100902996 223.81878769523112L105.80912664146891 225.74048282655937L106.60184469084584 242.2688994693887L104.59237615121395 244.28437107700415Z", "c": [100.5, 233.7] }, { "d": "M124.21819411935533 232.88728875536825L125.90275027846057 221.68367522106143L147.2075657894737 232.1567495126706L147.73351506191094 233.31253927185364L146.63120966951803 235.7347103314538L124.51385876221849 234.09759606214536Z", "c": [135.3, 227.4] }, { "d": "M122.60481904036226 238.73037819744565L124.51385876221849 234.09759606214536L146.63120966951803 235.7347103314538L143.93551064818212 241.65815423359984L126.53612070334539 251.08059309603448Z", "c": [134.2, 242.3] }, { "d": "M104.59237615121395 244.28437107700415L106.60184469084584 242.2688994693887L122.60481904036226 238.73037819744565L126.53612070334539 251.08059309603448L115.24024517669888 257.1977441504646Z", "c": [115.2, 248.4] }, { "d": "M105.80912664146891 225.74048282655937L124.21819411935533 232.88728875536825L124.51385876221849 234.09759606214536L122.60481904036226 238.73037819744565L106.60184469084584 242.2688994693887Z", "c": [111.9, 233.1] }] }, { "name": "গাজীপুর", "d": "M182.2487737126317 235.73080580152197L196.4772718380123 208.18052756855457L221.40850178359096 206.17987331366245L229.51814083061473 219.56244639126135L219.53607996020375 249.3028133144445L217.4300688623883 250.19490380628054L185.72315424950227 241.30022478946432Z", "c": [209.4, 231.6], "subs": [{ "d": "M198.40634900406243 235.30072448549325L203.57283962985875 228.23976184087402L216.2602152860198 226.87111928608593L218.01259704284465 234.84838139016733L202.11860896328784 245.89960977517973L200.2378457546554 245.37200293447427Z", "c": [211, 232.3] }, { "d": "M205.70161729558512 207.44030231578637L221.40850178359096 206.17987331366245L229.51814083061473 219.56244639126135L229.2614258068771 220.3272983692013L218.28593462698296 222.913042697518Z", "c": [219.8, 214.7] }, { "d": "M203.57283962985875 228.23976184087402L204.16042715820413 207.56397806755152L205.70161729558512 207.44030231578637L218.28593462698296 222.913042697518L216.2602152860198 226.87111928608593Z", "c": [210, 222.7] }, { "d": "M202.11860896328784 245.89960977517975L218.01259704284465 234.84838139016733L223.60897679521506 237.16810006374078L219.53607996020375 249.3028133144445L217.4300688623883 250.19490380628054Z", "c": [218, 242.3] }, { "d": "M182.2487737126317 235.73080580152197L187.22743074198408 226.09075910253085L198.40634900406243 235.30072448549325L200.2378457546554 245.37200293447427L185.72315424950227 241.30022478946432Z", "c": [185.5, 236.9] }, { "d": "M216.2602152860198 226.87111928608593L218.28593462698296 222.913042697518L229.2614258068771 220.3272983692013L223.60897679521506 237.16810006374078L218.01259704284465 234.84838139016733Z", "c": [223.3, 229.6] }, { "d": "M187.22743074198408 226.09075910253085L196.4772718380123 208.18052756855457L204.16042715820413 207.56397806755152L203.57283962985875 228.23976184087402L198.40634900406243 235.30072448549325Z", "c": [197.5, 222.4] }] }, { "name": "নরসিংদী", "d": "M219.53607996020375 249.3028133144445L229.51814083061473 219.56244639126135L256.52466534155445 228.45871328898264L246.462780454977 262.08323999855793Z", "c": [238.3, 241.3], "subs": [{ "d": "M219.53607996020375 249.3028133144445L221.48662425206098 243.49139784695234L241.99916869993973 232.24701177063358L245.98311610001923 234.74271669220914L248.44825651106058 247.3540133170629L223.75147813650108 251.30360013000592Z", "c": [240.9, 241.3] }, { "d": "M241.43068177063853 223.48657752444564L256.52466534155445 228.45871328898264L255.5141035914766 231.83578040316684L245.98311610001923 234.74271669220914L241.99916869993973 232.24701177063358Z", "c": [249.6, 227.3] }, { "d": "M245.98311610001923 234.74271669220914L255.5141035914766 231.83578040316684L250.50013612910917 248.5913172394327L248.44825651106058 247.3540133170629Z", "c": [253.2, 238.9] }, { "d": "M223.75147813650108 251.30360013000592L248.44825651106058 247.3540133170629L250.50013612910917 248.5913172394327L246.462780454977 262.08323999855793Z", "c": [243.2, 255.5] }, { "d": "M221.48662425206098 243.49139784695234L229.51814083061473 219.56244639126135L241.43068177063853 223.48657752444564L241.99916869993973 232.24701177063358Z", "c": [233.8, 228.3] }] }, { "name": "ব্রাহ্মণবাড়িয়া", "d": "M246.462780454977 262.08323999855793L256.52466534155445 228.45871328898264L269.00191350786486 223.93236073223042L285.51181397006417 233.6464183891661L285.3 236.4L286.5 238.3L286.5 240.1L285.3 243.1L284.4 244L279.5 243.4L278 244.9L277.4 248.6L274.4 249.8L273.8 255.3L275 257.1L275 258.9L273.2 261.9L273.2 265.6L268.6 265.3L267.1 267.4L267.1 271.6L271.3 272.9L271 273.8L267.7 274.1L267.7 274.13975903614454L252.3837455505094 273.9552258500061Z", "c": [264.7, 249.2], "subs": [{ "d": "M250.99735453478343 246.92972661793897L254.05300625883334 236.71843478060762L274.75158570971035 245.52913812362092L276.6842243039516 248.88631027841936L274.4 249.8L273.8 255.3L275 257.1L275 258.9L274.22297010798803 260.19504982001996L261.7837228129638 257.8188036153758Z", "c": [269.3, 251] }, { "d": "M254.96469253344517 233.67178697684147L256.52466534155445 228.45871328898264L269.00191350786486 223.93236073223042L284.53426106082946 233.0712480333694L284.5319629984674 233.0723975586309Z", "c": [274.7, 228.7] }, { "d": "M274.75158570971035 245.52913812362092L284.5319629984674 233.0723975586309L284.53426106082946 233.0712480333694L285.51181397006417 233.6464183891661L285.3 236.4L286.5 238.3L286.5 240.1L285.3 243.1L284.4 244L279.5 243.4L278 244.9L277.4 248.6L276.6842243039516 248.88631027841936Z", "c": [282.2, 243.6] }, { "d": "M259.3921799179786 274.0396648182889L261.7837228129638 257.8188036153758L274.22297010798803 260.19504982001996L273.2 261.9L273.2 265.6L268.6 265.3L267.1 267.4L267.1 271.6L271.3 272.9L271 273.8L267.7 274.1L267.7 274.13975903614454Z", "c": [266.3, 267] }, { "d": "M254.05300625883334 236.71843478060762L254.96469253344517 233.67178697684147L284.5319629984674 233.0723975586309L274.75158570971035 245.52913812362092Z", "c": [274.9, 237.9] }, { "d": "M246.462780454977 262.08323999855793L250.99735453478343 246.92972661793897L261.7837228129638 257.8188036153758L259.3921799179786 274.0396648182889L252.3837455505094 273.9552258500061Z", "c": [254.8, 265.3] }] }, { "name": "মানিকগঞ্জ", "d": "M143.93551064818212 241.65815423359984L147.73351506191094 233.31253927185364L182.2487737126317 235.73080580152197L185.72315424950227 241.30022478946432L182.13587307278596 275.4790426676228L152.65491174987392 270.8726424609178Z", "c": [166.6, 258.3], "subs": [{ "d": "M143.93551064818212 241.65815423359984L147.73351506191094 233.31253927185364L155.30396790210762 233.84295316511583L159.93278107744408 242.7501616405548L147.95539929846535 255.12685331960043Z", "c": [151.4, 242.5] }, { "d": "M152.44062340008423 270.1546660312101L164.68359207007177 262.9155814689407L182.5771765016044 271.27440166526924L182.13587307278596 275.4790426676228L152.65491174987392 270.8726424609178Z", "c": [172.9, 272.3] }, { "d": "M155.30396790210762 233.84295316511583L172.6146119327975 235.05580083605588L165.08741966786044 244.14777076815858L159.93278107744408 242.7501616405548Z", "c": [164.6, 235.7] }, { "d": "M147.95539929846535 255.12685331960043L159.93278107744408 242.7501616405548L165.08741966786044 244.14777076815858L171.1857034146684 253.83270191152369L164.68359207007177 262.9155814689407L152.44062340008423 270.1546660312101Z", "c": [160.4, 251.2] }, { "d": "M165.08741966786044 244.14777076815858L172.6146119327975 235.05580083605588L182.2487737126317 235.73080580152197L184.00811442359523 238.55102237190545L172.6557705039576 253.5688818524458L171.1857034146684 253.83270191152369Z", "c": [173.5, 243] }, { "d": "M164.68359207007177 262.9155814689407L171.1857034146684 253.83270191152369L172.6557705039576 253.5688818524458L183.94752102581455 258.2180635596003L182.5771765016044 271.27440166526924Z", "c": [177.1, 263.2] }, { "d": "M172.6557705039576 253.5688818524458L184.00811442359523 238.55102237190545L185.72315424950227 241.30022478946432L183.94752102581455 258.2180635596003Z", "c": [182.6, 249.9] }] }, { "name": "ঢাকা", "d": "M182.13587307278596 275.4790426676228L185.72315424950227 241.30022478946432L217.4300688623883 250.19490380628054L210.54454229320282 274.09751746788163L184.00430761191427 278.3558387040585Z", "c": [200.9, 261.9], "subs": [{ "d": "M183.71027063979724 260.4785325152652L185.72315424950227 241.30022478946432L196.82874475641438 244.4156544696212L195.28749796522035 260.5999180901457L189.36977050296346 262.64623105732875Z", "c": [189.1, 254.6] }, { "d": "M182.13587307278596 275.4790426676228L183.71027063979724 260.4785325152652L189.36977050296346 262.64623105732875L188.42830616145935 277.64601804125834L184.00430761191427 278.3558387040585Z", "c": [183.8, 268.5] }, { "d": "M195.28749796522035 260.5999180901457L196.82874475641438 244.4156544696212L217.4300688623883 250.19490380628054L216.18880494798427 254.503862823426L200.5720891941516 263.9118304699162Z", "c": [202.5, 255.9] }, { "d": "M200.5720891941516 263.9118304699162L216.18880494798427 254.503862823426L210.54454229320282 274.09751746788163L203.04469031328296 275.3008519273464Z", "c": [208.6, 266] }, { "d": "M188.42830616145935 277.64601804125834L189.36977050296346 262.64623105732875L195.28749796522035 260.5999180901457L200.5720891941516 263.9118304699162L203.04469031328296 275.30085192734634Z", "c": [194.2, 269.1] }] }, { "name": "নারায়ণগঞ্জ", "d": "M210.54454229320282 274.09751746788163L217.4300688623883 250.19490380628054L219.53607996020375 249.3028133144445L246.462780454977 262.08323999855793L252.3837455505094 273.9552258500061L243.42473062385662 285.5334876655142L226.33774459422065 290.0502470648693Z", "c": [225.2, 268.9], "subs": [{ "d": "M223.9933553408194 287.68217711193876L231.88912057460863 278.6242961461631L244.89845041414264 283.6289129199286L243.42473062385662 285.5334876655142L226.33774459422065 290.0502470648693Z", "c": [230.9, 286.5] }, { "d": "M210.54454229320282 274.09751746788163L217.4300688623883 250.19490380628054L219.53607996020375 249.3028133144445L222.14889616668714 250.54295433998553L223.50018324494818 270.148625058842L211.79476456094696 275.3603682433808Z", "c": [216.1, 262.5] }, { "d": "M222.14889616668714 250.54295433998553L236.07051124981493 257.1506774410353L236.63453699919032 264.5875277563946L226.48873741454236 271.00763815464427L223.50018324494818 270.148625058842Z", "c": [229.7, 261.6] }, { "d": "M226.48873741454236 271.00763815464427L236.63453699919032 264.5875277563946L252.14751670435194 273.4815690264925L252.3837455505094 273.9552258500061L244.89845041414264 283.6289129199286L231.88912057460863 278.6242961461631Z", "c": [236.4, 272.1] }, { "d": "M236.07051124981493 257.1506774410353L246.462780454977 262.08323999855793L252.14751670435194 273.4815690264925L236.63453699919032 264.5875277563946Z", "c": [243, 260.6] }, { "d": "M211.79476456094696 275.3603682433808L223.50018324494818 270.148625058842L226.48873741454236 271.00763815464427L231.88912057460863 278.6242961461631L223.99335534081936 287.68217711193876Z", "c": [224.2, 280.7] }] }, { "name": "কুষ্টিয়া", "d": "M72.01504854368935 232.75L95.08157894736841 232.75L115.24024517669888 257.1977441504646L111.07128450106157 269.4916135881104L89.29750838524198 272.0532343076186L79.418129462844 262.8493684739316Z", "c": [93.7, 254.3], "subs": [{ "d": "M103.09637707414754 270.42983799127677L108.28922473431285 248.76778318842196L115.24024517669888 257.1977441504646L111.07128450106157 269.4916135881104Z", "c": [110.5, 267.8] }, { "d": "M81.1541186553795 240.79095914724468L93.10404492123851 232.75L95.08157894736841 232.75L106.18179477286867 246.21196387347902L96.59281883345743 253.35950905413276L81.74471404696655 253.84010143074244Z", "c": [86.1, 249.1] }, { "d": "M74.17054164875779 241.5137811771862L81.1541186553795 240.79095914724468L81.74471404696655 253.84010143074244L78.14024490878491 257.6537589054544Z", "c": [77, 249.5] }, { "d": "M72.01504854368935 232.75L93.10404492123851 232.75L81.1541186553795 240.79095914724468L74.17054164875779 241.5137811771862Z", "c": [75.3, 233.1] }, { "d": "M78.14024490878491 257.6537589054544L81.74471404696655 253.84010143074244L96.59281883345743 253.35950905413276L87.19282180220573 270.0924579182942L79.418129462844 262.8493684739316Z", "c": [86.4, 258.3] }, { "d": "M87.19282180220573 270.0924579182942L96.59281883345743 253.35950905413276L106.18179477286867 246.21196387347902L108.28922473431285 248.76778318842196L103.09637707414754 270.42983799127677L89.29750838524198 272.0532343076186Z", "c": [97.7, 264.7] }] }, { "name": "মেহেরপুর", "d": "M51.5 269.2L52.1 268.6L54 255.9L55.5 255L59.7 255L60.3 253.7L65.5 251L66.1 236.4L64.9 235.8L64.3 231.6L66.1 230.4L66.03448572596433 229.60290966589935L66.7255828332661 229.52624279187222L72.01504854368935 232.75L79.418129462844 262.8493684739316L54.22858559153999 277.35727032385984L54 275.3L51.5 274.7Z", "c": [62.8, 261.9], "subs": [{ "d": "M54.45090098984876 255.62945940609075L55.5 255L59.7 255L60.3 253.7L64.83608298997399 251.3447261398212L77.7893634205743 256.22714864417713L79.418129462844 262.8493684739316L63.48838094901698 272.02409704835094Z", "c": [64.9, 260.4] }, { "d": "M64.3 231.6L66.1 230.4L66.03448572596433 229.60290966589935L66.7255828332661 229.52624279187222L72.01504854368935 232.75L77.7893634205743 256.22714864417713L64.83608298997399 251.3447261398212L65.5 251L66.1 236.4L64.9 235.8Z", "c": [70.9, 244.6] }, { "d": "M51.5 269.2L52.1 268.6L54 255.9L54.45090098984876 255.62945940609075L63.48838094901698 272.02409704835094L54.22858559153999 277.35727032385984L54 275.3L51.5 274.7Z", "c": [52.9, 267] }] }, { "name": "চুয়াডাঙ্গা", "d": "M54.22858559153999 277.35727032385984L79.418129462844 262.8493684739316L89.29750838524198 272.0532343076186L74.7238172391445 307.52504860661054L68.06350736765509 311.3854829907222L67.6 310.8L64.9 310.5L64.9 308.7L63.7 308.1L66.1 306.3L66.1 302.6L67.3 301.4L67.9 295.3L70.4 294.1L70.4 289.3L66.4 289L58.8 282L57.9 278L54.3 278Z", "c": [71.9, 277.7], "subs": [{ "d": "M70.3389961002618 284.5493886881908L71.29995477707243 282.5231847611892L89.14122184063748 271.9076340224742L89.29750838524198 272.0532343076186L82.25035109402855 289.20574922396827Z", "c": [82.9, 284.5] }, { "d": "M54.22858559153999 277.35727032385984L67.77667982978511 269.55425402208573L71.29995477707243 282.5231847611892L70.3389961002618 284.5493886881908L65.99247151249293 288.6246448141382L58.8 282L57.9 278L54.3 278Z", "c": [62.4, 274.8] }, { "d": "M63.7 308.1L66.1 306.3L66.1 302.6L67.3 301.4L67.9 295.3L70.4 294.1L70.4 289.3L66.4 289L65.99247151249293 288.6246448141382L70.3389961002618 284.5493886881908L82.25035109402855 289.20574922396827L74.7238172391445 307.52504860661054L68.06350736765509 311.3854829907222L67.6 310.8L64.9 310.5L64.9 308.7Z", "c": [79.5, 293.1] }, { "d": "M67.77667982978511 269.55425402208573L79.418129462844 262.8493684739316L89.14122184063748 271.9076340224742L71.29995477707243 282.5231847611892Z", "c": [75.1, 271.4] }] }, { "name": "ঝিনাইদহ", "d": "M74.7238172391445 307.52504860661054L89.29750838524198 272.0532343076186L111.07128450106157 269.4916135881104L115.10840027942719 276.7305798113867L106.9595785440613 306.20029129270984Z", "c": [97.7, 288.3], "subs": [{ "d": "M89.80680135803249 291.0217838372643L98.79388900922089 270.9360130577387L111.07128450106157 269.4916135881104L115.10840027942719 276.7305798113867L112.27748252836429 286.96841934947713L94.8826829382785 294.607544987335L91.7952929934913 293.9647598478363Z", "c": [100, 285.7] }, { "d": "M74.7238172391445 307.52504860661054L82.44949037243728 288.72105173501114L89.80680135803249 291.0217838372643L91.7952929934913 293.9647598478363L86.32882197821534 307.048130603635Z", "c": [81.1, 298.5] }, { "d": "M86.32882197821534 307.048130603635L91.7952929934913 293.9647598478363L94.8826829382785 294.607544987335L105.4056945541314 306.2641495388713Z", "c": [96.1, 304.8] }, { "d": "M94.8826829382785 294.607544987335L112.27748252836429 286.96841934947713L106.9595785440613 306.20029129270984L105.4056945541314 306.2641495388713Z", "c": [104.9, 296.8] }, { "d": "M82.44949037243728 288.72105173501114L89.29750838524198 272.0532343076186L98.79388900922089 270.9360130577387L89.80680135803249 291.0217838372643Z", "c": [86.9, 279.9] }] }, { "name": "মাগুরা", "d": "M106.9595785440613 306.20029129270984L115.10840027942719 276.7305798113867L142.0101162066819 286.4775783357543L145.7938739104909 303.3932010116064L115.56952663980181 313.5423360729817Z", "c": [124.1, 295.6], "subs": [{ "d": "M110.07490786529961 294.9338948433001L115.10840027942719 276.7305798113867L132.50373047104358 283.0332356779143L128.83673553423378 290.25321313992265L117.55822022514482 297.15965452065507Z", "c": [119.6, 284.4] }, { "d": "M117.55822022514482 297.15965452065507L128.83673553423378 290.25321313992265L135.7354506384605 299.3495536005172L131.4032811101364 308.2254664906922L123.6689298310549 310.82261027813286Z", "c": [129.9, 301.1] }, { "d": "M131.4032811101364 308.2254664906922L135.7354506384605 299.3495536005172L145.10464735105745 300.3119528635509L145.7938739104909 303.3932010116064Z", "c": [137.9, 305] }, { "d": "M106.9595785440613 306.20029129270984L110.07490786529961 294.9338948433001L117.55822022514482 297.15965452065507L123.6689298310549 310.82261027813286L115.56952663980181 313.5423360729817Z", "c": [112.3, 309] }, { "d": "M128.83673553423378 290.25321313992265L132.50373047104358 283.0332356779143L142.0101162066819 286.4775783357543L145.10464735105745 300.3119528635509L135.7354506384605 299.3495536005172Z", "c": [139, 294.2] }] }, { "name": "রাজবাড়ী", "d": "M111.07128450106157 269.4916135881104L115.24024517669888 257.1977441504646L143.93551064818212 241.65815423359984L152.65491174987392 270.8726424609178L142.0101162066819 286.4775783357543L115.10840027942719 276.7305798113867Z", "c": [134.1, 268], "subs": [{ "d": "M114.54756360799313 259.24039636766986L115.24024517669888 257.1977441504646L131.2988038544879 248.50141698956963L133.6345928920511 254.44973456127136L131.34472913113103 258.4328845868268L117.70801627344953 261.29106469582206Z", "c": [123.3, 254.9] }, { "d": "M117.70801627344953 261.29106469582206L131.34472913113103 258.4328845868268L132.55248081280902 271.02805692137565L122.66206805163547 274.62660229295227Z", "c": [125.4, 264.8] }, { "d": "M131.2988038544879 248.50141698956963L143.93551064818212 241.65815423359984L148.63919429741554 257.4179190377325L133.6345928920511 254.44973456127136Z", "c": [141.5, 247.8] }, { "d": "M120.0417977733784 278.5180426715139L122.66206805163547 274.62660229295227L132.55248081280902 271.02805692137565L147.9440267538168 277.77865187922146L142.0101162066819 286.4775783357543Z", "c": [131, 280.4] }, { "d": "M131.34472913113103 258.4328845868268L133.6345928920511 254.44973456127136L148.63919429741554 257.4179190377325L152.65491174987392 270.8726424609178L147.9440267538168 277.77865187922146L132.55248081280902 271.02805692137565Z", "c": [138.4, 263.6] }, { "d": "M111.07128450106157 269.4916135881104L114.54756360799313 259.24039636766986L117.70801627344953 261.29106469582206L122.66206805163547 274.62660229295227L120.0417977733784 278.5180426715139L115.10840027942719 276.7305798113867Z", "c": [114.2, 269] }] }, { "name": "ফরিদপুর", "d": "M142.0101162066819 286.4775783357543L152.65491174987392 270.8726424609178L182.13587307278596 275.4790426676228L184.00430761191427 278.3558387040585L183.42917087967643 293.84858442871587L159.8358269273876 308.7066764678736L152.52719136213145 308.85929298779774L145.7938739104909 303.3932010116064Z", "c": [162.1, 287.1], "subs": [{ "d": "M144.06548055801963 283.4644787631126L152.65491174987392 270.8726424609178L158.9886586658491 271.86229041653894L149.38711868681986 283.90260629190175Z", "c": [153.7, 271.3] }, { "d": "M163.97773844150794 306.09827544514036L172.90472585343855 287.2553064049398L183.48953770958113 292.2224529481581L183.42917087967643 293.84858442871587Z", "c": [176, 297.7] }, { "d": "M142.0101162066819 286.4775783357543L144.06548055801963 283.4644787631126L149.38711868681986 283.90260629190175L152.93914662241488 285.50247422043253L163.2826032921945 306.53604221737237L159.8358269273876 308.7066764678736L152.52719136213145 308.85929298779774L145.7938739104909 303.3932010116064Z", "c": [151.6, 297] }, { "d": "M149.38711868681986 283.90260629190175L158.9886586658491 271.86229041653894L173.3824704972829 274.11132351520047L171.00375409218253 282.80000174260823L152.93914662241488 285.50247422043253Z", "c": [160.7, 276.9] }, { "d": "M152.93914662241488 285.50247422043253L171.00375409218253 282.80000174260823L172.90472585343855 287.2553064049398L163.9777384415079 306.09827544514036L163.2826032921945 306.53604221737237Z", "c": [162.9, 291.5] }, { "d": "M171.00375409218253 282.80000174260823L173.3824704972829 274.11132351520047L182.13587307278596 275.4790426676228L184.00430761191427 278.3558387040585L183.48953770958113 292.2224529481581L172.90472585343855 287.2553064049398Z", "c": [182.9, 282.9] }] }, { "name": "মুন্সিগঞ্জ", "d": "M183.42917087967643 293.84858442871587L184.00430761191427 278.3558387040585L210.54454229320282 274.09751746788163L226.33774459422065 290.0502470648693L221.3717689668319 297.5359049071401L188.07366863905324 298.08477469276284Z", "c": [205.2, 288.7], "subs": [{ "d": "M210.4767791564481 297.7154926512673L214.3929025847802 277.9847500856365L226.33774459422065 290.0502470648693L221.3717689668319 297.5359049071401Z", "c": [219, 289.1] }, { "d": "M183.60198485487084 289.1934079719168L184.00430761191427 278.3558387040585L199.48201801312183 275.87247472177523L197.12403503638376 281.91266281089815Z", "c": [187.6, 279.3] }, { "d": "M183.42917087967643 293.84858442871587L183.60198485487084 289.1934079719168L197.12403503638376 281.91266281089815L203.56547002091358 297.82941532932557L188.07366863905324 298.08477469276284Z", "c": [194, 291.3] }, { "d": "M197.12403503638376 281.91266281089815L199.48201801312183 275.87247472177523L210.54454229320282 274.09751746788163L214.3929025847802 277.9847500856365L210.4767791564481 297.7154926512673L203.56547002091358 297.82941532932557Z", "c": [205.9, 286.5] }] }, { "name": "শরীয়তপুর", "d": "M188.07366863905324 298.08477469276284L221.3717689668319 297.5359049071401L219.21151233014595 328.70532209360846L212.78795745313894 335.5823043736983L199.22608370702545 328.9683856502242Z", "c": [205.5, 306.9], "subs": [{ "d": "M188.07366863905324 298.08477469276284L211.54881386986202 297.69782174939786L208.89926839943212 301.6376778531145L191.23703324616864 306.84486129708233Z", "c": [197.6, 299] }, { "d": "M195.878886187633 319.69922328882967L207.57552071894122 319.28358894907245L207.91575168666745 319.55086631471505L208.4311289082719 333.45754562521637L199.22608370702545 328.9683856502242Z", "c": [201.5, 329] }, { "d": "M207.91575168666745 319.55086631471505L219.8164965866568 319.9762635353808L219.21151233014595 328.70532209360846L212.78795745313894 335.5823043736983L208.4311289082719 333.45754562521637Z", "c": [215, 328.5] }, { "d": "M191.23703324616864 306.84486129708233L208.89926839943212 301.6376778531145L207.57552071894122 319.28358894907245L195.878886187633 319.69922328882967Z", "c": [200.8, 310] }, { "d": "M207.57552071894122 319.28358894907245L208.89926839943212 301.6376778531145L211.54881386986202 297.69782174939786L221.3717689668319 297.5359049071401L219.8164965866568 319.9762635353808L207.91575168666745 319.55086631471505Z", "c": [215.6, 311.1] }] }, { "name": "চাঁদপুর", "d": "M219.21151233014595 328.70532209360846L221.3717689668319 297.5359049071401L226.33774459422065 290.0502470648693L243.42473062385662 285.5334876655142L256.1817254116646 321.63578291501085Z", "c": [235.8, 309], "subs": [{ "d": "M228.85835327601748 307.5481719514725L237.32932615932864 303.2014747293239L238.21179383673433 303.152607138281L252.05810063238158 309.96592478963987L254.84790484127114 317.86107070079737L235.29606379257737 316.4765972719955Z", "c": [242.5, 312.6] }, { "d": "M238.21179383673433 303.152607138281L246.8285660649986 295.16634196394597L252.05810063238158 309.96592478963987Z", "c": [248.3, 300.7] }, { "d": "M236.83223004724422 287.27614367828454L243.42473062385662 285.5334876655142L246.8285660649986 295.16634196394597L238.21179383673433 303.152607138281L237.32932615932864 303.2014747293239Z", "c": [241.4, 293.2] }, { "d": "M219.21151233014595 328.70532209360846L220.74195667292042 306.6231965764342L228.85835327601748 307.5481719514725L235.29606379257737 316.4765972719955L235.87254167580898 325.5193572344064Z", "c": [229.4, 322.1] }, { "d": "M220.74195667292042 306.6231965764342L221.3717689668319 297.5359049071401L226.33774459422065 290.0502470648693L236.83223004724422 287.27614367828454L237.32932615932864 303.2014747293239L228.85835327601748 307.5481719514725Z", "c": [232.7, 293.5] }, { "d": "M235.29606379257737 316.4765972719955L254.84790484127114 317.86107070079737L256.1817254116646 321.63578291501085L235.87254167580898 325.5193572344064Z", "c": [241.9, 321.3] }] }, { "name": "কুমিল্লা", "d": "M243.42473062385662 285.5334876655142L252.3837455505094 273.9552258500061L267.7 274.13975903614454L267.7 280.2L270.7 283.2L271.3 287.4L275.6 291.1L275.6 293.5L278 297.2L278 300.2L279.2 302L279.2 305.7L280.5 306.9L280.5 309.3L281.7 311.1L281.87431343878774 313.9180672604015L265.37379599673847 324.49078487072256L261.844502495513 324.636108720773L256.1817254116646 321.63578291501085Z", "c": [264.1, 299], "subs": [{ "d": "M243.42473062385662 285.5334876655142L252.3837455505094 273.9552258500061L262.09912730901635 274.0722786422773L263.7927746589197 286.3975626761718L261.83170102901255 288.6687506167604L244.2867587303755 287.9730272069627Z", "c": [258.1, 284] }, { "d": "M244.2867587303755 287.9730272069627L261.83170102901255 288.6687506167604L263.4505680136995 299.6609586412887L255.9626211447451 305.31912286955117L250.7122035354673 306.15703600537245Z", "c": [257.8, 293] }, { "d": "M270.21617124162987 315.48430601636807L279.2 302.47953820252553L279.2 305.7L280.5 306.9L280.5 309.3L281.7 311.1L281.87431343878774 313.9180672604015L270.90755344178973 320.94502607885323Z", "c": [278.9, 314.3] }, { "d": "M250.7122035354673 306.15703600537245L255.9626211447451 305.31912286955117L270.21617124162987 315.48430601636807L270.90755344178973 320.94502607885323L265.37379599673847 324.49078487072256L261.844502495513 324.636108720773L256.1817254116646 321.63578291501085Z", "c": [261.5, 316.5] }, { "d": "M255.9626211447451 305.31912286955117L263.4505680136995 299.6609586412887L278 298.3973033561538L278 300.2L279.2 302L279.2 302.47953820252553L270.21617124162987 315.48430601636807Z", "c": [268.3, 306.9] }, { "d": "M261.83170102901255 288.6687506167604L263.7927746589197 286.3975626761718L271.81508561398033 287.8432132027272L275.6 291.1L275.6 293.5L278 297.2L278 298.3973033561538L263.4505680136995 299.6609586412887Z", "c": [267, 291.7] }, { "d": "M262.09912730901635 274.0722786422773L267.7 274.13975903614454L267.7 280.2L270.7 283.2L271.3 287.4L271.81508561398033 287.8432132027272L263.7927746589197 286.3975626761718Z", "c": [268.6, 282.6] }] }, { "name": "মাদারীপুর", "d": "M159.8358269273876 308.7066764678736L183.42917087967643 293.84858442871587L188.07366863905324 298.08477469276284L199.22608370702545 328.9683856502242L179.27425076009845 332.3886998696974Z", "c": [180.3, 316], "subs": [{ "d": "M159.8358269273876 308.7066764678736L166.28596863460672 304.6446495103861L179.22867606112365 315.8849138328539L175.5645830743376 327.8691751539465Z", "c": [169.6, 319.7] }, { "d": "M175.5645830743376 327.8691751539465L179.22867606112365 315.8849138328539L193.5346167331576 313.2074001841287L195.27658344015174 318.0313079881124L186.50959117296873 331.1483557989196L179.27425076009845 332.3886998696974Z", "c": [185.1, 324.4] }, { "d": "M166.28596863460672 304.6446495103861L183.42917087967643 293.84858442871587L188.07366863905324 298.08477469276284L193.5346167331576 313.2074001841287L179.22867606112365 315.8849138328539Z", "c": [181.6, 305.8] }, { "d": "M186.50959117296873 331.1483557989196L195.27658344015174 318.0313079881124L199.22608370702545 328.9683856502242Z", "c": [193.3, 329.9] }] }, { "name": "গোপালগঞ্জ", "d": "M142.3532626088402 349.2837032342082L152.52719136213145 308.85929298779774L159.8358269273876 308.7066764678736L179.27425076009845 332.3886998696974L169.47587406381996 345.24552940758883L148.75982341593706 350.87129396052825Z", "c": [163, 330.2], "subs": [{ "d": "M149.9100861946282 319.25792418667726L152.52719136213145 308.85929298779774L159.8358269273876 308.7066764678736L165.96182683012992 316.1700425465667Z", "c": [157.2, 313.4] }, { "d": "M160.84028351089322 334.0756493114068L172.2711494324011 323.85675247750277L179.27425076009845 332.3886998696974L169.47587406381996 345.24552940758883L166.67910213392386 346.005036161714Z", "c": [172.6, 337.4] }, { "d": "M147.3261535278511 329.52474998267166L149.9100861946282 319.25792418667726L165.96182683012992 316.1700425465667L172.2711494324011 323.85675247750277L160.84028351089322 334.0756493114068L154.8738331968268 333.4054951498287Z", "c": [158.9, 322] }, { "d": "M142.3532626088402 349.2837032342082L147.3261535278511 329.52474998267166L154.8738331968268 333.4054951498287L150.556696807571 350.3833251481037L148.75982341593706 350.87129396052825Z", "c": [148, 343.3] }, { "d": "M150.556696807571 350.3833251481037L154.8738331968268 333.4054951498287L160.84028351089322 334.0756493114068L166.6791021339239 346.005036161714Z", "c": [156.2, 345.4] }] }, { "name": "নড়াইল", "d": "M115.56952663980181 313.5423360729817L145.7938739104909 303.3932010116064L152.52719136213145 308.85929298779774L142.3532626088402 349.2837032342082L132.4487172192624 352.734439386886L120.52557503817171 350.10555213515244L117.67625369772878 347.65125034418Z", "c": [133.2, 322.7], "subs": [{ "d": "M116.1702761686366 323.2687570160212L132.07720857953555 321.14659369865007L132.2729129263849 321.6013424054626L133.1541512280417 328.8542853265811L122.54682748382204 341.1580937484027L117.3224183007106 341.9224867734095Z", "c": [120.9, 331.6] }, { "d": "M115.56952663980181 313.5423360729817L131.65865424068892 308.13971388965797L132.98309836598884 317.00537815083356L132.07720857953555 321.14659369865007L116.1702761686366 323.2687570160212Z", "c": [118.6, 314] }, { "d": "M122.54682748382204 341.1580937484027L133.1541512280417 328.8542853265811L144.4786824293852 340.8387018139094L142.3532626088402 349.2837032342082L134.54509561096455 352.00406273440973Z", "c": [132.2, 341.4] }, { "d": "M132.2729129263849 321.6013424054626L148.50758601407202 324.83052490408716L144.4786824293852 340.8387018139094L133.1541512280417 328.8542853265811Z", "c": [145.7, 328.6] }, { "d": "M117.3224183007106 341.9224867734095L122.54682748382204 341.1580937484027L134.54509561096455 352.00406273440973L132.4487172192624 352.734439386886L120.52557503817171 350.10555213515244L117.67625369772878 347.65125034418Z", "c": [123.7, 350.8] }, { "d": "M131.65865424068892 308.13971388965797L145.7938739104909 303.3932010116064L152.52719136213145 308.85929298779774L151.1273451567153 314.4213485773179L132.98309836598884 317.00537815083356Z", "c": [145.9, 309.9] }, { "d": "M132.07720857953555 321.14659369865007L132.98309836598884 317.00537815083356L151.1273451567153 314.4213485773179L148.50758601407202 324.83052490408716L132.2729129263849 321.6013424054626Z", "c": [147.4, 320.3] }] }, { "name": "যশোর", "d": "M68.06350736765509 311.3854829907222L74.7238172391445 307.52504860661054L106.9595785440613 306.20029129270984L115.56952663980181 313.5423360729817L117.67625369772878 347.65125034418L82.31413440467497 344.35978816654494L82.2 344.2L79.5 343.9L78.3 337.8L75.2 337.2L76.4 336.6L77 334.2L77 328.1L76.4 326.9L81.9 321.4L81.9 319.6L83.1 318.4L83.1 314.8L81.6 314.5L79.8 312.6L76.7 312L70.7 312L69.5 313.2Z", "c": [99.2, 324.8], "subs": [{ "d": "M107.52192127132027 331.7472268455157L108.7578367482237 321.1841268888985L116.14529935998313 322.86437059020307L116.85037155695694 334.2798252078742L112.36990285919421 335.784305663119Z", "c": [112.8, 328.5] }, { "d": "M90.62397323058048 322.6597888388108L102.55436590937548 314.2062339273447L108.7578367482237 321.1841268888985L107.52192127132027 331.7472268455157L97.33762671316954 333.8211052725423L93.45826807837524 332.59737690483524Z", "c": [103.2, 327.3] }, { "d": "M75.2 337.2L76.4 336.6L77 334.2L77 328.1L76.4 326.9L81.9 321.4L81.9 319.77325177390753L90.62397323058048 322.6597888388108L93.45826807837524 332.59737690483524L86.44138426350956 344.7439474612813L82.31413440467497 344.35978816654494L82.2 344.2L79.5 343.9L78.3 337.8Z", "c": [82.4, 333.3] }, { "d": "M102.55436590937548 314.2062339273447L104.78480489698973 306.2896655521785L106.9595785440613 306.20029129270984L115.56952663980181 313.5423360729817L116.14529935998313 322.86437059020307L108.7578367482237 321.1841268888985Z", "c": [115.5, 316.4] }, { "d": "M68.06350736765509 311.3854829907222L74.7238172391445 307.52504860661054L104.78480489698973 306.2896655521785L102.55436590937548 314.2062339273447L90.62397323058048 322.6597888388108L81.9 319.77325177390753L81.9 319.6L83.1 318.4L83.1 314.8L81.6 314.5L79.8 312.6L76.7 312L70.7 312L69.5 313.2Z", "c": [90.4, 309.3] }, { "d": "M86.44138426350956 344.7439474612813L93.45826807837524 332.59737690483524L97.33762671316954 333.8211052725423L106.63756833223056 346.6237832099212Z", "c": [98.4, 342.5] }, { "d": "M97.33762671316954 333.8211052725423L107.52192127132027 331.7472268455157L112.36990285919421 335.784305663119L108.76604357878884 346.8218990443264L106.63756833223056 346.6237832099212Z", "c": [105.2, 337.5] }, { "d": "M108.76604357878884 346.8218990443264L112.36990285919421 335.784305663119L116.85037155695694 334.2798252078742L117.67625369772878 347.65125034418Z", "c": [117.1, 341.4] }] }, { "name": "সাতক্ষীরা", "d": "M80.1 356.7L83.7 353.6L83.7 346.3L82.31413440467497 344.35978816654494L117.67625369772878 347.65125034418L120.52557503817171 350.10555213515244L91.07525773195874 404.6752577319587L89.8 403.4L89.8 401.6L88 399.8L88 396.1L86.2 394.9L86.2 389.4L85.5 388.2L86.8 387L86.8 382.2L84.9 380.3L84.9 376.7L82.5 374.3L82.5 368.8L81.3 367.6L82.5 366.4L82.5 360.9L80.1 358.5Z", "c": [95.3, 366.7], "subs": [{ "d": "M87.97044029588564 381.29097683666186L93.57023132969618 362.79090452397344L95.54300954916704 362.7801045145798L105.5475146696935 374.3988804009723L90.3778664650457 381.42807102834666Z", "c": [96.5, 372.3] }, { "d": "M80.1 356.7L81.97436132842547 355.08596663385583L93.57023132969618 362.79090452397344L87.97044029588564 381.29097683666186L86.51743153701314 381.91743153701316L84.9 380.3L84.9 376.7L82.5 374.3L82.5 368.8L81.3 367.6L82.5 366.4L82.5 360.9L80.1 358.5Z", "c": [85.9, 369.1] }, { "d": "M81.97436132842547 355.08596663385583L83.7 353.6L83.7 346.3L82.31413440467497 344.35978816654494L101.69872921542932 346.16408219427626L104.8474642192287 356.1755755294327L95.54300954916704 362.7801045145798L93.57023132969618 362.79090452397344Z", "c": [96.4, 353.3] }, { "d": "M90.3778664650457 381.42807102834666L105.5475146696935 374.3988804009723L107.23299791310846 374.73591563159306L100.02593297772866 388.09018301185563Z", "c": [101.3, 382.7] }, { "d": "M101.69872921542932 346.16408219427626L117.67625369772878 347.65125034418L120.52557503817171 350.10555213515244L115.38419953368901 359.63221851110563L104.8474642192287 356.1755755294327Z", "c": [110.1, 348.9] }, { "d": "M85.5 388.2L86.8 387L86.8 382.2L86.51743153701314 381.91743153701316L87.97044029588564 381.29097683666186L90.3778664650457 381.42807102834666L100.02593297772866 388.09018301185563L91.07525773195874 404.6752577319587L89.8 403.4L89.8 401.6L88 399.8L88 396.1L86.2 394.9L86.2 389.4Z", "c": [95.4, 391.2] }, { "d": "M95.54300954916704 362.7801045145798L104.8474642192287 356.1755755294327L115.38419953368901 359.63221851110563L107.23299791310848 374.73591563159306L105.5475146696935 374.3988804009723Z", "c": [104.8, 365.1] }] }, { "name": "খুলনা", "d": "M89.2 433.2L90.1 432.3L92.8 431.9L94 428.3L94 423.4L91 419.2L91 415.6L92.2 414.3L91.6 405.2L91.07525773195874 404.6752577319587L120.52557503817171 350.10555213515244L132.4487172192624 352.734439386886L141.74918945158157 417.2177135309657L128.1258241758242 443.2L126.5 443.2L125.3 445.6L123.2 446.5L123.2 449L121.7 450.5L116.2 451.1L114.4 453.5L110.7 453.5L110.1 455.3L108.3 455.3L106.5 457.1L102.8 457.1L101.3 455.6L103.2 452.6L103.2 447.1L102.2 446.2L98.6 446.2L98.3 448.3L96.8 450.5L94.3 450.5L92.2 446.5L89.2 444.1L89.8 436.2Z", "c": [120.5, 380.3], "subs": [{ "d": "M121.14900074211005 423.5677345040465L125.67262814175874 412.6713025445875L128.4416196404585 410.2156918987608L141.09353392684136 412.67183522610014L141.74918945158157 417.2177135309657L133.62032440005598 432.7209681352226L122.66709189362139 426.9664274701368Z", "c": [133.1, 424.5] }, { "d": "M119.29046504348749 380.91737189681106L124.40007390892085 366.30524831522973L133.90781368064896 362.8508415191661L137.40486608124388 387.0970714966243L131.61657645234092 388.63257571559456Z", "c": [132.3, 376.7] }, { "d": "M91 415.6L92.2 414.3L91.6 405.2L91.07525773195874 404.6752577319587L95.41209864522787 396.63934662796004L96.15085642034133 396.72635147470146L104.70664636853343 401.18055717068825L108.33505605097568 408.6390031921843L103.10642628751934 420.69667202964655L92.57503850738992 421.4050539103459L91 419.2Z", "c": [100.6, 410.8] }, { "d": "M114.9403257531566 397.1317991028396L118.03829480468589 381.3862796746652L119.29046504348749 380.91737189681106L131.61657645234092 388.63257571559456L127.38649892266284 405.46605645710093Z", "c": [121.1, 394.4] }, { "d": "M104.70664636853343 401.18055717068825L114.9403257531566 397.1317991028396L127.38649892266284 405.46605645710093L128.4416196404585 410.2156918987608L125.67262814175874 412.6713025445875L108.33505605097568 408.6390031921843Z", "c": [114.8, 403.9] }, { "d": "M103.16266175202115 457.1L109.2570220395153 424.81903315419527L121.14900074211005 423.5677345040465L122.66709189362139 426.9664274701368L114.72609240529356 453.0652101262753L114.4 453.5L110.7 453.5L110.1 455.3L108.3 455.3L106.5 457.1Z", "c": [113.9, 433.1] }, { "d": "M89.2 433.2L90.1 432.3L92.8 431.9L94 428.3L94 423.4L92.57503850738992 421.4050539103459L103.10642628751934 420.69667202964655L109.2570220395153 424.81903315419527L103.16266175202115 457.1L102.8 457.1L101.3 455.6L103.2 452.6L103.2 447.1L102.2 446.2L98.6 446.2L98.3 448.3L96.8 450.5L94.3 450.5L92.2 446.5L89.2 444.1L89.8 436.2Z", "c": [101.9, 430.8] }, { "d": "M95.41209864522787 396.63934662796004L106.50258472335989 376.08932830671546L115.80196760600617 381.2323092634863L96.15085642034133 396.72635147470146Z", "c": [103.7, 384.1] }, { "d": "M114.72609240529356 453.0652101262753L122.66709189362139 426.9664274701368L133.62032440005598 432.7209681352226L128.1258241758242 443.2L126.5 443.2L125.3 445.6L123.2 446.5L123.2 449L121.7 450.5L116.2 451.1Z", "c": [126.6, 437] }, { "d": "M96.15085642034133 396.72635147470146L115.80196760600617 381.2323092634863L118.03829480468589 381.3862796746652L114.9403257531566 397.1317991028396L104.70664636853343 401.18055717068825Z", "c": [110.2, 392.3] }, { "d": "M106.50258472335989 376.08932830671546L115.38327886136025 359.6339244627736L124.40007390892085 366.30524831522973L119.29046504348749 380.91737189681106L118.03829480468589 381.3862796746652L115.80196760600617 381.2323092634863Z", "c": [111.8, 369.5] }, { "d": "M127.38649892266284 405.46605645710093L131.61657645234092 388.63257571559456L137.40486608124388 387.0970714966243L141.09353392684136 412.67183522610014L128.4416196404585 410.2156918987608Z", "c": [138.1, 398.7] }, { "d": "M103.10642628751934 420.69667202964655L108.33505605097568 408.6390031921843L125.67262814175874 412.6713025445875L121.14900074211005 423.5677345040465L109.2570220395153 424.81903315419527Z", "c": [112, 415.8] }, { "d": "M115.38327886136025 359.6339244627736L120.52557503817171 350.10555213515244L132.4487172192624 352.734439386886L133.90781368064896 362.8508415191661L124.40007390892085 366.30524831522973Z", "c": [123.8, 353.3] }] }, { "name": "বাগেরহাট", "d": "M132.4487172192624 352.734439386886L142.3532626088402 349.2837032342082L148.75982341593706 350.87129396052825L168.7 378.4807692307692L168.7 394.10686015831135L141.74918945158157 417.2177135309657Z", "c": [151.7, 375.8], "subs": [{ "d": "M137.49970302098208 387.7546076121425L148.1189281587156 384.5746707230388L153.03303405684107 392.67909244398294L151.16314931231668 397.5799907272295L139.97812709223348 404.9383478394856Z", "c": [143.5, 395.7] }, { "d": "M145.07253852949913 371.00341853159154L146.54607066028888 358.43619246127054L151.02466270472985 354.0072252834721L164.91699410938685 373.2427610745356L150.3917511384624 378.12044705680086Z", "c": [153.6, 366.3] }, { "d": "M139.97812709223348 404.9383478394856L151.16314931231668 397.5799907272295L155.20815071140672 405.6763879123821L141.74918945158157 417.2177135309657Z", "c": [149.9, 405.4] }, { "d": "M148.1189281587156 384.5746707230388L150.3917511384624 378.12044705680086L164.91699410938685 373.2427610745356L168.7 378.4807692307692L168.7 394.10686015831135L168.20739972041434 394.5292746460827L153.03303405684107 392.67909244398294Z", "c": [160.1, 385.6] }, { "d": "M151.16314931231668 397.5799907272295L153.03303405684107 392.67909244398294L168.20739972041434 394.5292746460827L155.20815071140672 405.6763879123821Z", "c": [158.2, 401.3] }, { "d": "M133.13956994065524 357.52435158854297L146.54607066028888 358.43619246127054L145.07253852949913 371.00341853159154L135.11699746609622 371.2345157649338Z", "c": [137.8, 364.5] }, { "d": "M132.4487172192624 352.734439386886L142.3532626088402 349.2837032342082L148.75982341593706 350.87129396052825L151.02466270472985 354.0072252834721L146.54607066028888 358.43619246127054L133.13956994065524 357.52435158854297Z", "c": [138.7, 351.3] }, { "d": "M135.1169974660962 371.2345157649338L145.07253852949913 371.00341853159154L150.3917511384624 378.12044705680086L148.1189281587156 384.5746707230388L137.49970302098205 387.7546076121425Z", "c": [138.2, 377.9] }] }, { "name": "পিরোজপুর", "d": "M148.75982341593706 350.87129396052825L169.47587406381996 345.24552940758883L185.6492957746479 361.65000000000003L168.7 378.4807692307692Z", "c": [171.5, 361.5], "subs": [{ "d": "M158.3417367666685 348.26917691639994L169.47587406381996 345.24552940758883L183.71281155172233 359.685851716747L172.39334283891594 359.29947743635546Z", "c": [167.8, 349.5] }, { "d": "M159.26270503404476 365.41374543175425L172.39334283891594 359.29947743635546L183.71281155172233 359.685851716747L185.6492957746479 361.65000000000003L168.7 378.4807692307692Z", "c": [167.2, 368.8] }, { "d": "M148.75982341593706 350.87129396052825L158.3417367666685 348.26917691639994L172.39334283891594 359.29947743635546L159.26270503404476 365.41374543175425Z", "c": [161.8, 357.2] }] }, { "name": "ঝালকাঠি", "d": "M168.7 378.4807692307692L185.6492957746479 361.65000000000003L213.60959595959594 361.65000000000003L212.80766003518744 366.32009744214366L190.29524020134372 394.96155304226954L168.7 394.10686015831135Z", "c": [185.7, 375.8], "subs": [{ "d": "M179.6627888618513 367.59464322809174L185.6492957746479 361.65000000000003L194.36494587817506 361.65000000000003L199.50539588173305 379.6329201273185L195.7238590607993 380.1192480397419Z", "c": [188.3, 368.4] }, { "d": "M194.36494587817506 361.65000000000003L213.60959595959594 361.65000000000003L212.80766003518744 366.32009744214366L201.66365732955805 380.49806947077167L199.50539588173305 379.6329201273185Z", "c": [203.1, 364.2] }, { "d": "M168.7 378.4807692307692L168.82612899904524 378.35552225269635L183.53470096250976 386.28302713679966L182.56380760144816 394.6555596676035L168.7 394.10686015831135Z", "c": [174.2, 391.3] }, { "d": "M168.82612899904524 378.35552225269635L179.6627888618513 367.59464322809174L195.7238590607993 380.1192480397419L183.53470096250976 386.28302713679966Z", "c": [182.6, 375.7] }, { "d": "M182.56380760144816 394.6555596676035L183.53470096250976 386.28302713679966L195.7238590607993 380.1192480397419L199.50539588173305 379.6329201273185L201.66365732955805 380.49806947077167L190.29524020134372 394.96155304226954Z", "c": [191.5, 393.3] }] }, { "name": "বরিশাল", "d": "M169.47587406381996 345.24552940758883L179.27425076009845 332.3886998696974L199.22608370702545 328.9683856502242L212.78795745313894 335.5823043736983L215.54375579365808 359.04834478842184L213.60959595959594 361.65L185.6492957746479 361.65Z", "c": [185.7, 347.5], "subs": [{ "d": "M184.2636942319689 360.24460414956843L196.89653789860665 345.52006070982395L197.29824478339097 345.37439286942197L211.01987237334677 361.65L185.6492957746479 361.65Z", "c": [202, 359.1] }, { "d": "M175.55577798156875 337.2678520126237L179.27425076009845 332.3886998696974L187.34627060539808 331.00492503907464L187.50098700710174 337.2325568016464Z", "c": [182.6, 332] }, { "d": "M197.94170459101207 344.8144951945581L202.6944005350891 330.65983080282666L212.78795745313894 335.5823043736983L213.92357187372792 345.25223322780437Z", "c": [210.5, 337.9] }, { "d": "M197.29824478339097 345.37439286942197L197.94170459101207 344.8144951945581L213.92357187372792 345.25223322780437L215.54375579365808 359.04834478842184L213.60959595959594 361.65L211.01987237334677 361.65Z", "c": [210.1, 352.4] }, { "d": "M169.47587406381996 345.24552940758883L175.55577798156875 337.2678520126237L187.50098700710174 337.2325568016464L196.89653789860665 345.52006070982395L184.2636942319689 360.24460414956843Z", "c": [182.6, 342.5] }, { "d": "M187.34627060539808 331.00492503907464L199.22608370702545 328.9683856502242L202.6944005350891 330.65983080282666L197.94170459101207 344.8144951945581L197.29824478339097 345.37439286942197L196.89653789860665 345.52006070982395L187.50098700710174 337.2325568016464Z", "c": [192.1, 331.8] }] }, { "name": "ভোলা", "d": "M212.80766003518744 366.32009744214366L213.60959595959594 361.65L215.54375579365808 359.04834478842184L247.13145824182718 363.92478733226363L258.0882515012363 373.82742847050514L257.1 375.2L254.3 376.1L254.6 381.2L263.1 380.6L265 381.9L267.0201612903225 381.9L273.2 387.4852769679301L273.2 390.7L272.3 391.6L269.5 391.9L269.5 396.7L271.3 399.8L270.7 405.8L269.5 407.7L269.5 409.5L267.1 411.9L265.9 416.8L263.8 419.5L262.2 419.8L261.9 421.9L260.7 420.7L258.3 420.1L256.2 418L255.9 413.4L252.2 413.4L249.5 416.2L248.6 420.1L245.8 419.8L244.9 412.8L241.3 412.8L239.8 414.3L236.7 419.8L235.66571988246812 420.6619000979432Z", "c": [235.2, 384.3], "subs": [{ "d": "M232.59249628753966 376.1201259701631L237.67575658943886 362.46503615551245L247.13145824182718 363.92478733226363L248.7640810360274 365.4003356302288L243.6943797098566 379.8658096267301L241.73250268247327 381.29833735954026Z", "c": [241.7, 368.6] }, { "d": "M221.9187816458131 387.9804997617444L230.6830099423065 376.138855216298L232.59249628753966 376.1201259701631L241.73250268247327 381.29833735954026L243.11790909463778 393.8448657392944L229.13496956311295 401.6444138585039L227.7416898733442 401.8236400762523Z", "c": [230.8, 387.7] }, { "d": "M260.942985515828 380.7522598459416L263.1 380.6L265 381.9L267.0201612903225 381.9L273.2 387.4852769679301L273.2 390.7L272.3 391.6L269.5 391.9L269.5 393.6249495844242L261.55375479704276 387.35204540403026Z", "c": [268.8, 383.8] }, { "d": "M229.13496956311295 401.6444138585039L243.11790909463778 393.8448657392944L247.17994028937292 396.01591282517734L254.1525002958229 406.2268847835997L253.16432742335385 413.4L252.2 413.4L249.5 416.2L248.6 420.1L246.42280718035377 419.8667293407522L245.71228921305573 419.1178049904333L244.9 412.8L241.3 412.8L240.48842758430135 413.6115724156987Z", "c": [241.9, 407.5] }, { "d": "M227.7416898733442 401.8236400762523L229.13496956311295 401.6444138585039L240.48842758430135 413.6115724156987L239.8 414.3L236.7 419.8L235.66571988246812 420.6619000979432ZM245.71228921305573 419.1178049904333L246.42280718035377 419.8667293407522L245.8 419.8Z", "c": [234.3, 414.7] }, { "d": "M253.16432742335385 413.4L254.1525002958229 406.2268847835997L271.29034912553146 399.7833790495264L271.3 399.8L270.7 405.8L269.5 407.7L269.5 409.5L267.1 411.9L265.9 416.8L263.8 419.5L262.2 419.8L261.9 421.9L260.7 420.7L258.3 420.1L256.2 418L255.9 413.4Z", "c": [265.6, 410.8] }, { "d": "M243.6943797098566 379.8658096267301L248.7640810360274 365.4003356302288L258.0882515012363 373.82742847050514L257.1 375.2L254.3 376.1L254.44859608378948 378.6261334244214Z", "c": [252.3, 372.4] }, { "d": "M212.80766003518744 366.32009744214366L213.60959595959594 361.65L215.54375579365808 359.04834478842184L224.49227153800499 360.42979767983024L229.39549159768282 375.1778214371988L215.2935416770476 372.2299292699622Z", "c": [222, 367.4] }, { "d": "M224.49227153800499 360.42979767983024L237.67575658943886 362.46503615551245L232.59249628753966 376.1201259701631L230.6830099423065 376.138855216298L229.39549159768282 375.1778214371988Z", "c": [230.6, 364.5] }, { "d": "M247.17994028937292 396.01591282517734L261.55375479704276 387.35204540403026L269.5 393.6249495844242L269.5 396.7L271.29034912553146 399.7833790495264L254.1525002958229 406.2268847835997Z", "c": [259.8, 395.2] }, { "d": "M215.2935416770476 372.2299292699622L229.39549159768282 375.1778214371988L230.6830099423065 376.138855216298L221.9187816458131 387.9804997617444Z", "c": [219.5, 379.4] }, { "d": "M241.73250268247327 381.29833735954026L243.6943797098566 379.8658096267301L254.44859608378948 378.6261334244214L254.6 381.2L260.942985515828 380.7522598459416L261.55375479704276 387.35204540403026L247.17994028937292 396.01591282517734L243.11790909463778 393.8448657392944Z", "c": [253.8, 385.2] }] }, { "name": "পটুয়াখালী", "d": "M190.29524020134372 394.96155304226954L212.80766003518744 366.32009744214366L235.66571988246812 420.6619000979432L233.1 422.8L232.5 432.6L234 432.9L235.5 434.4L234.3 436.8L234.9 441.7L233.4 443.2L230.1 442.9L230.1 441.1L232.5 439.8L232.5 433.8L228.5 433.5L225.8 435L225.8 438.6L224.9 440.1L224.3 439.5L222.7496124031008 439.5Z", "c": [210, 394.9], "subs": [{ "d": "M197.75906883207182 385.4656872974165L200.87884714784607 381.4965452516932L210.75254563619976 383.4566092730274L215.18372788357672 396.48975049989275L206.38395189434706 404.5028071409373Z", "c": [206.7, 389.6] }, { "d": "M205.91877478159296 416.2483447565917L230.1284783033505 407.4978918155126L235.66571988246812 420.6619000979432L233.1 422.8L232.87168729683782 426.5291074849823L230.19058971850723 427.27026687276947Z", "c": [224.6, 414.7] }, { "d": "M205.79130375979958 416.22742750015044L205.91877478159296 416.2483447565917L230.19058971850723 427.27026687276947L222.4670177568871 439.112183942962Z", "c": [217, 431.3] }, { "d": "M203.13578254304005 412.5831483835337L206.38395189434706 404.5028071409373L215.18372788357672 396.48975049989275L224.76677634985373 394.7512041524825L230.1284783033505 407.4978918155126L205.91877478159296 416.2483447565917L205.79130375979955 416.22742750015044Z", "c": [221.2, 405.5] }, { "d": "M200.87884714784607 381.4965452516932L212.80766003518744 366.32009744214366L217.56278922116914 377.6247441861757L210.75254563619976 383.4566092730274Z", "c": [209.4, 376.2] }, { "d": "M210.75254563619976 383.4566092730274L217.56278922116914 377.6247441861757L224.76677634985373 394.7512041524825L215.18372788357672 396.48975049989275Z", "c": [217.7, 385.9] }, { "d": "M190.29524020134372 394.96155304226954L197.75906883207182 385.4656872974165L206.38395189434706 404.5028071409373L203.13578254304005 412.5831483835337Z", "c": [195, 395] }, { "d": "M222.4670177568871 439.112183942962L230.19058971850723 427.27026687276947L232.87168729683782 426.5291074849823L232.5 432.6L234 432.9L235.5 434.4L234.3 436.8L234.9 441.7L233.4 443.2L230.1 442.9L230.1 441.1L232.5 439.8L232.5 433.8L228.5 433.5L225.8 435L225.8 438.6L224.9 440.1L224.3 439.5L222.7496124031008 439.5Z", "c": [231.8, 441] }] }, { "name": "বরগুনা", "d": "M128.1258241758242 443.2L141.74918945158157 417.2177135309657L168.7 394.10686015831135L190.29524020134372 394.96155304226954L222.7496124031008 439.5L220.6 439.5L220 437.7L214 438.3L213.4 443.2L201.8 442.6L201.2 443.2L198.8 442.6L197.6 440.1L193.9 440.1L187.9 444.4L181.2 443.8L178.4 441.7L178.1 440.1L175.1 440.1L173 438L173.6 437.4L173.6 428.3L169.6 428L167.8 428.6L164.5 424.7L164.5 422.8L163.3 421L163.3 416.8L159.3 416.5L157.2 418.6L157.2 422.8L158.4 425.3L159.6 431.3L159.6 435.6L158.7 436.5L156.3 436.5L153.9 439.5L152.6 439.5L151.4 440.8L145.4 440.8L145 445.9L142.9 447.4L137.5 447.4L136.9 451.1L132.6 451.1L131.7 450.2L131.7 444.7L130.2 443.2Z", "c": [184.2, 413.7], "subs": [{ "d": "M135.39104234322346 429.34388032145705L140.54874193232592 419.50718978774967L148.38092635444812 428.15571849072984L149.63060095966617 437.92057134007456L138.64911551090842 438.73478150681007Z", "c": [142.5, 433.7] }, { "d": "M193.05421270329248 428.24550000433874L193.6172418547186 422.19234191218567L204.21172946333485 414.0597138379808L222.7496124031008 439.5L220.6 439.5L220 437.7L214 438.3L213.4 443.2L201.8 442.6L201.34237973530492 443.05762026469506Z", "c": [204.1, 421.2] }, { "d": "M173 438L173.6 437.4L173.6 430.08260087621727L177.43485304060403 425.895682863144L193.05421270329248 428.24550000433874L201.34237973530492 443.05762026469506L201.2 443.2L198.8 442.6L197.6 440.1L193.9 440.1L187.9 444.4L181.2 443.8L178.4 441.7L178.1 440.1L175.1 440.1Z", "c": [181.2, 434] }, { "d": "M144.95535589861132 414.4683623560721L160.43618518596628 401.1932448933007L164.39761765637553 408.3800785427878L162.84618121242212 413.6266839487334L161.73317656160242 414.5978706643383Z", "c": [154.6, 406.3] }, { "d": "M162.84618121242212 413.6266839487334L164.39761765637553 408.3800785427878L180.4327259821131 401.04635587203666L184.0444481511012 408.4485985761448L175.81732274784432 419.3076184454691Z", "c": [173.8, 411.9] }, { "d": "M180.4327259821131 401.04635587203666L181.34079543803924 394.6071554922707L190.29524020134372 394.96155304226954L198.36903522899857 406.04154834617884L187.7670377775856 410.59209502092136L184.0444481511012 408.4485985761448Z", "c": [193.1, 402.5] }, { "d": "M175.81732274784432 419.3076184454691L184.0444481511012 408.4485985761448L187.7670377775856 410.59209502092136L193.6172418547186 422.19234191218567L193.05421270329248 428.24550000433874L177.43485304060403 425.895682863144Z", "c": [183.5, 419.3] }, { "d": "M187.7670377775856 410.59209502092136L198.36903522899857 406.04154834617884L204.21172946333485 414.0597138379808L193.6172418547186 422.19234191218567Z", "c": [197.3, 412.3] }, { "d": "M128.1258241758242 443.2L135.39104234322346 429.34388032145705L138.64911551090842 438.73478150681007L131.98780068095894 450.4878006809589L131.7 450.2L131.7 444.7L130.2 443.2Z", "c": [132.5, 437.1] }, { "d": "M140.54874193232592 419.50718978774967L141.74918945158157 417.2177135309657L144.95535589861132 414.4683623560721L161.73317656160242 414.5978706643383L161.73488038862217 416.6826160291467L159.3 416.5L157.2 418.6L157.2 422.8L158.4 425.3L158.73854218260865 426.99271091304325L148.38092635444812 428.15571849072984Z", "c": [154.5, 422.8] }, { "d": "M148.38092635444812 428.15571849072984L158.73854218260865 426.99271091304325L159.6 431.3L159.6 435.6L158.7 436.5L156.3 436.5L153.9 439.5L152.6 439.5L151.8255945193321 440.3389392707236L149.63060095966617 437.92057134007456Z", "c": [155.5, 432] }, { "d": "M131.98780068095894 450.4878006809589L138.64911551090842 438.73478150681007L149.63060095966617 437.92057134007456L151.8255945193321 440.3389392707236L151.4 440.8L145.4 440.8L145 445.9L142.9 447.4L137.5 447.4L136.9 451.1L132.6 451.1Z", "c": [143.2, 443.2] }, { "d": "M161.73317656160242 414.5978706643383L162.84618121242212 413.6266839487334L175.81732274784432 419.3076184454691L177.43485304060403 425.895682863144L173.6 430.08260087621727L173.6 428.3L169.6 428L167.8 428.6L164.5 424.7L164.5 422.8L163.3 421L163.3 416.8L161.73488038862217 416.6826160291467Z", "c": [169, 422.8] }, { "d": "M160.43618518596628 401.1932448933007L168.7 394.10686015831135L181.34079543803924 394.6071554922707L180.4327259821131 401.04635587203666L164.39761765637553 408.3800785427878Z", "c": [167.8, 398.9] }] }, { "name": "লক্ষ্মীপুর", "d": "M212.78795745313894 335.5823043736983L219.21151233014595 328.70532209360846L256.1817254116646 321.63578291501085L261.844502495513 324.636108720773L247.13145824182718 363.92478733226363L215.54375579365808 359.04834478842184Z", "c": [241.9, 340.9], "subs": [{ "d": "M212.78795745313894 335.5823043736983L219.21151233014595 328.70532209360846L221.17341328966904 328.3301623489975L222.92030172432248 338.12829233709175L213.80767398484895 344.26534514371366Z", "c": [215, 336.1] }, { "d": "M213.80767398484895 344.26534514371366L222.92030172432248 338.12829233709175L232.8922030371354 344.2992814630328L231.42645791495727 348.8270909700974L215.17813575440402 355.93503475719785Z", "c": [221.8, 346.2] }, { "d": "M231.42645791495727 348.8270909700974L232.8922030371354 344.2992814630328L235.0997061653198 342.98925143202456L236.22291050542205 342.82888326746314L252.00031101329265 350.92334531615256L247.74046360837897 362.29854223257036L233.74166108926133 354.8363260768245Z", "c": [240.8, 352.3] }, { "d": "M221.17341328966904 328.3301623489975L232.87393314259918 326.09275886614876L235.0997061653198 342.98925143202456L232.8922030371354 344.2992814630328L222.92030172432248 338.12829233709175Z", "c": [229.6, 333.5] }, { "d": "M232.87393314259916 326.09275886614876L256.1817254116646 321.63578291501085L256.8261626447453 321.9772269859987L236.22291050542205 342.82888326746314L235.0997061653198 342.98925143202456Z", "c": [237.9, 332.4] }, { "d": "M230.4697354005993 361.352585879816L233.74166108926133 354.8363260768245L247.74046360837897 362.29854223257036L247.13145824182718 363.92478733226363Z", "c": [235.6, 362.1] }, { "d": "M215.17813575440402 355.93503475719785L231.42645791495727 348.8270909700974L233.74166108926133 354.8363260768245L230.4697354005993 361.352585879816L215.54375579365808 359.04834478842184Z", "c": [226.8, 357.7] }, { "d": "M236.22291050542205 342.82888326746314L256.8261626447453 321.9772269859987L261.844502495513 324.636108720773L252.00031101329265 350.92334531615256Z", "c": [246.6, 341] }] }, { "name": "নোয়াখালী", "d": "M247.13145824182718 363.92478733226363L261.844502495513 324.636108720773L265.37379599673847 324.49078487072256L286.41985915492955 357.9801408450705L285.3 359.1L285.3 362.7L282.6 365.5L278.6 365.8L278.6 372.4L277.1 374L267.4 373.4L263.8 374.6L262.5 372.7L258.9 372.7L258.0882515012363 373.82742847050514ZM267.0201612903225 381.9L268 381.9L273.2 386.4L273.2 387.4852769679301ZM289.6 380.3L291.4 374.3L294.3947096417863 370.6700489190469L295.34250075597214 372.178212881766L290.1988785046729 381.73065420560744Z", "c": [266.2, 350], "subs": [{ "d": "M253.35046260264622 347.317995467659L261.844502495513 324.636108720773L265.37379599673847 324.49078487072256L276.68908493794805 342.4961351567349L271.35506115326297 349.0099180684124L262.30890825021066 351.98544595705437L255.9593987565371 349.48791100771393Z", "c": [267.9, 339.9] }, { "d": "M252.6016387411185 368.8686822441596L255.9593987565371 349.48791100771393L262.30890825021066 351.98544595705437L268.520799112762 367.58762540753645L265.98222965773715 373.8725901140876L263.8 374.6L262.5 372.7L258.9 372.7L258.0882515012363 373.82742847050514Z", "c": [258.2, 364.6] }, { "d": "M262.30890825021066 351.98544595705437L271.35506115326297 349.0099180684124L285.3 361.4969106696181L285.3 362.7L285.08620207509614 362.92171636656695L268.520799112762 367.58762540753645Z", "c": [274, 358.3] }, { "d": "M271.35506115326297 349.0099180684124L276.68908493794805 342.4961351567349L286.41985915492955 357.9801408450705L285.3 359.1L285.3 361.4969106696181Z", "c": [280.9, 350.6] }, { "d": "M247.13145824182718 363.92478733226363L253.35046260264622 347.317995467659L255.9593987565371 349.48791100771393L252.6016387411185 368.8686822441596Z", "c": [248.7, 363] }, { "d": "M265.98222965773715 373.8725901140876L268.520799112762 367.58762540753645L285.08620207509614 362.92171636656695L282.6 365.5L278.6 365.8L278.6 372.4L277.1 374L267.4 373.4ZM267.0201612903225 381.9L268 381.9L273.2 386.4L273.2 387.4852769679301ZM289.6 380.3L291.4 374.3L294.3947096417863 370.6700489190469L295.34250075597214 372.178212881766L290.1988785046729 381.73065420560744Z", "c": [278, 372.6] }] }, { "name": "ফেনী", "d": "M265.37379599673847 324.49078487072256L281.87431343878774 313.9180672604015L282.3 320.8L284.1 326.3L285.6 327.8L290.2 327.5L290.2 323.9L288.3 320.2L288.3 316L290.8 311.7L291.7 311.4L293.2 313.5L293.2 315.4L295 316L295 317.8L296.2 318.4L296.2 320.8L298.1 323.9L298.1 325.7L299.3 326.9L299.3 331.2L300.5 332.4L300.5 334.8L302.6 337.5L303.8 337.5L305 338.7L309.3 338.7L310.5 337.5L317.2 336.9L318.1906639004149 335.90933609958506L321.2725231402125 341.4638498457319L319.498075697002 351.09240892282537L302.9961297888976 365.4972325384415L301.1 362.1L297.2 358.8L291.7 358.8L290.5 357.6L286.8 357.6L286.41985915492955 357.9801408450705ZM294.3947096417863 370.6700489190469L294.7 370.3L296.0022803114572 371.6022803114572L295.34250075597214 372.178212881766Z", "c": [288, 336.3], "subs": [{ "d": "M285.14592609553495 355.9530064877857L291.7922933976087 332.5674500405226L293.32050701312056 331.5165434867371L299.49708166178937 331.39708166178934L300.5 332.4L300.5 334.8L302.6 337.5L303.8 337.5L304.4673167655199 338.1673167655199L302.21083644249785 347.0317543631652L289.9073216893344 357.6L286.8 357.6L286.41985915492955 357.9801408450705Z", "c": [294.8, 344.7] }, { "d": "M265.37379599673847 324.49078487072256L281.87431343878774 313.9180672604015L282.3 320.8L284.1 326.3L285.6 327.8L290.2 327.5L290.2 325.9228559949789L293.32050701312056 331.5165434867371L291.7922933976087 332.5674500405226L271.4874771306137 334.2191241932394Z", "c": [281.6, 325.4] }, { "d": "M289.9073216893344 357.6L302.21083644249785 347.0317543631652L312.242058578029 357.42630719959556L309.24265836125085 360.0445336388248L298.13184426681397 359.58848361038105L297.2 358.8L291.7 358.8L290.5 357.6Z", "c": [303.4, 354.7] }, { "d": "M302.21083644249785 347.0317543631652L304.4673167655199 338.1673167655199L305 338.7L309.3 338.7L310.5 337.5L317.2 336.9L318.1906639004149 335.90933609958506L321.2725231402125 341.4638498457319L319.498075697002 351.09240892282537L312.242058578029 357.42630719959556Z", "c": [309.8, 348.5] }, { "d": "M288.3 316L290.8 311.7L291.7 311.4L293.2 313.5L293.2 315.4L295 316L295 317.8L296.2 318.4L296.2 320.8L298.1 323.9L298.1 325.7L299.3 326.9L299.3 331.2L299.49708166178937 331.39708166178934L293.32050701312056 331.5165434867371L290.2 325.9228559949789L290.2 323.9L288.3 320.2Z", "c": [294.3, 318.3] }, { "d": "M294.3947096417863 370.6700489190469L294.7 370.3L296.0022803114572 371.6022803114572L295.34250075597214 372.178212881766ZM298.13184426681397 359.58848361038105L309.24265836125085 360.0445336388248L302.9961297888976 365.4972325384415L301.1 362.1Z", "c": [303, 364.9] }, { "d": "M271.4874771306137 334.2191241932394L291.7922933976087 332.5674500405226L285.14592609553495 355.9530064877857Z", "c": [282.8, 341.3] }] }, { "name": "চট্টগ্রাম", "d": "M290.1988785046729 381.73065420560744L295.34250075597214 372.178212881766L296.0022803114572 371.6022803114572L298.1 373.7L299.9 377.9L304.1 384L304.1 388.8L302.6 391L300.5 391.9L300.2 392.2L297.2 392.2L295 390.1L293.2 386.4L291.4 384.6ZM302.9961297888976 365.4972325384415L319.498075697002 351.09240892282537L378.4208047957396 391.0874457133093L331.41430679917346 426.0016924136574L328.4 426.3593220338983L328.4 422.8L326.6 421L326.6 414.9L325.4 414.3L323 405.2L319.3 399.8L319.3 396.1L318.1 393.1L318.1 388.2L313.8 379.1L303.5 366.4Z", "c": [329.9, 384.3], "subs": [{ "d": "M347.77398192212263 385.93946172765294L358.71150980154346 377.7093488317739L364.69120723267844 381.7681937361477L362.2078037830636 388.6544498009453L352.0494822850718 391.4829682685002Z", "c": [356.1, 385.5] }, { "d": "M309.6356655922925 359.701471076728L319.498075697002 351.09240892282537L334.5993909103869 361.34274299224586L332.07725854288293 368.1639485356612L321.6336263570516 370.22449249386955Z", "c": [328.8, 362.8] }, { "d": "M332.07725854288293 368.1639485356612L334.5993909103869 361.34274299224586L346.72566839737635 369.5737078786661L340.8711759360119 375.70119808666135L340.8327337833779 375.69127902052605Z", "c": [338.1, 366.2] }, { "d": "M340.02386819831196 404.6125422462595L351.8934627175645 394.97504042119544L361.127212208583 403.93232426536406L354.4545248233322 408.88848699716266Z", "c": [351.6, 401.7] }, { "d": "M321.6336263570516 370.22449249386955L332.07725854288293 368.1639485356612L340.8327337833779 375.69127902052605L324.33292284465153 381.2562872503217Z", "c": [331.1, 374.4] }, { "d": "M318.1 391.21464602025435L322.4335407486975 389.3716084204182L333.70429258198016 394.21679050986654L338.210797325673 404.8782013847741L328.4 424.9720330001224L328.4 422.8L326.6 421L326.6 414.9L325.4 414.3L323 405.2L319.3 399.8L319.3 396.1L318.1 393.1Z", "c": [325.4, 402.3] }, { "d": "M322.4335407486975 389.3716084204182L324.33292284465153 381.2562872503217L340.8327337833779 375.69127902052605L340.8711759360119 375.70119808666135L343.2921118137839 384.47137984867555L333.70429258198016 394.21679050986654Z", "c": [333.8, 382.6] }, { "d": "M362.2078037830636 388.6544498009453L364.69120723267844 381.7681937361477L378.4208047957396 391.0874457133093L366.82933443752273 399.6970523199559Z", "c": [368.9, 390.2] }, { "d": "M302.9961297888976 365.4972325384415L309.6356655922925 359.701471076728L321.6336263570516 370.22449249386955L324.33292284465153 381.2562872503217L322.4335407486975 389.3716084204182L318.1 391.21464602025435L318.1 388.2L313.8 379.1L303.5 366.4Z", "c": [315.2, 378.3] }, { "d": "M340.8711759360119 375.70119808666135L346.72566839737635 369.5737078786661L358.71150980154346 377.7093488317739L347.77398192212263 385.93946172765294L343.2921118137839 384.47137984867555Z", "c": [350.5, 378.1] }, { "d": "M351.8934627175645 394.97504042119544L352.0494822850718 391.4829682685002L362.2078037830636 388.6544498009453L366.82933443752273 399.6970523199559L361.127212208583 403.93232426536406Z", "c": [358.6, 394.5] }, { "d": "M328.4 424.9720330001224L338.210797325673 404.8782013847741L340.02386819831196 404.6125422462595L354.4545248233322 408.88848699716266L331.41430679917346 426.0016924136574L328.4 426.3593220338983Z", "c": [348.1, 413.4] }, { "d": "M290.1988785046729 381.73065420560744L295.34250075597214 372.178212881766L296.0022803114572 371.6022803114572L298.1 373.7L299.9 377.9L304.1 384L304.1 388.8L302.6 391L300.5 391.9L300.2 392.2L297.2 392.2L295 390.1L293.2 386.4L291.4 384.6Z", "c": [301.4, 389.3] }, { "d": "M333.70429258198016 394.21679050986654L343.2921118137839 384.47137984867555L347.77398192212263 385.93946172765294L352.0494822850718 391.4829682685002L351.8934627175645 394.97504042119544L340.02386819831196 404.6125422462595L338.210797325673 404.8782013847741Z", "c": [345.3, 393.9] }] }, { "name": "কক্সবাজার", "d": "M324.2 444.7L325.4 442.9L325.4 431.9L328.4 428.9L328.4 426.3593220338983L331.41430679917346 426.0016924136574L369.96602564102557 469.9L367 469.9L365.2 473.5L360.9 473.5L359.4 476.3L359.4 478.1L355.1 481.1L355.1 485.4L356.4 486.6L356.4 490.8L354.5 492.7L354.5 500L360 505.4L359.4 506.6L359.4 512.1L360 512.7L360.6 518.8L363.6 521.8L366.1 530.9L368.5 535.8L368.2 536.1L366.4 536.1L362.4 531.5L362.4 529.1L360.6 524.9L355.7 517.6L353.3 509.1L343 496.9L341.8 494.5L341.8 484.8L339.4 478.1L336 473.5L332.4 472.3L330.9 470.8L330.2 468.4L328.7 466.9L327.2 466.6L326.6 464.7L328.4 462.9L327.8 453.8L326 452L326 447.7L324.2 447.1Z", "c": [339.7, 466.9], "subs": [{ "d": "M341.5050830388292 483.6183863264172L344.15694671833575 465.40453877463193L348.5753015112846 463.9951810175977L358.23384689164317 477.4905113722097L346.3269361327392 484.381656046426Z", "c": [347.5, 474.9] }, { "d": "M325.4 431.9L328.4 428.9L328.4 426.3593220338983L331.41430679917346 426.0016924136574L343.7677736594901 440.06841380204713L332.2651487852708 444.5732597630545L325.4 441.25401193496737Z", "c": [339.7, 437] }, { "d": "M346.3269361327392 484.381656046426L358.23384689164317 477.4905113722097L359.4 477.71249407474545L359.4 478.1L355.1 481.1L355.1 485.4L356.4 486.6L356.4 490.8L354.5 492.7L354.5 499.79776323856555ZM354.7236165403544 500.2195507850752L360 505.4L359.4 506.6L359.4 509.0401876791812Z", "c": [355.1, 488.1] }, { "d": "M348.5753015112846 463.9951810175977L355.1466124345047 453.02533970644333L369.96602564102557 469.9L367 469.9L365.2 473.5L360.9 473.5L359.4 476.3L359.4 477.71249407474545L358.23384689164317 477.4905113722097Z", "c": [359.2, 466.5] }, { "d": "M341.38945675274704 483.6539001014188L341.5050830388292 483.6183863264172L346.3269361327392 484.381656046426L354.5 499.79776323856555L354.5 500L354.7236165403544 500.2195507850752L359.4 509.0401876791812L359.4 512.1L360 512.7L360.6 518.8L363.6 521.8L366.1 530.9L368.5 535.8L368.2 536.1L366.4 536.1L362.4 531.5L362.4 529.1L360.6 524.9L355.7 517.6L353.3 509.1L343 496.9L341.8 494.5L341.8 484.8Z", "c": [344.5, 493.8] }, { "d": "M332.2651487852708 444.5732597630545L343.7677736594901 440.06841380204713L354.3928141086517 452.16700000693186L336.50377638138144 449.6220789044316Z", "c": [342.9, 445.1] }, { "d": "M324.2 444.7L325.4 442.9L325.4 441.25401193496737L332.2651487852708 444.5732597630545L336.50377638138144 449.6220789044316L335.6350133384523 463.92657564149897L328.3444174849212 466.82888349698425L327.2 466.6L326.6 464.7L328.4 462.9L327.8 453.8L326 452L326 447.7L324.2 447.1Z", "c": [330.9, 455.1] }, { "d": "M335.6350133384523 463.92657564149897L336.50377638138144 449.6220789044316L354.3928141086517 452.16700000693186L355.1466124345047 453.02533970644333L348.5753015112846 463.9951810175977L344.15694671833575 465.40453877463193Z", "c": [341.4, 455.8] }, { "d": "M328.3444174849212 466.82888349698425L335.6350133384523 463.92657564149897L344.15694671833575 465.40453877463193L341.5050830388292 483.6183863264172L341.38945675274704 483.6539001014188L339.4 478.1L336 473.5L332.4 472.3L330.9 470.8L330.2 468.4L328.7 466.9Z", "c": [338.3, 473.6] }] }, { "name": "বান্দরবান", "d": "M331.41430679917346 426.0016924136574L378.4208047957396 391.0874457133093L384.7859023530631 389.91934539234995L384.9 390.1L385.5 393.1L386.1 403.4L387.3 406.4L387 408L384.9 408.3L384.9 412.5L386.7 416.2L387.9 427.7L390.4 430.7L388.5 432.6L387.9 435.6L387.9 459.3L389.1 461.7L389.7 468.4L391.6 473.2L391.6 476.3L394 481.7L390.7 483.3L388.8 485.1L386.1 478.1L386.1 475.7L385.2 474.8L380.9 474.8L379.7 476.6L376.1 476.6L375.2 475.7L375.2 472L372.4 469.9L369.96602564102557 469.9Z", "c": [370.9, 439.5], "subs": [{ "d": "M331.41430679917346 426.0016924136574L348.26681898800734 413.4844279255742L349.0892013025372 414.49517459876927L350.2180762968649 426.42265026199124L347.76412710245097 430.08420220447687L335.7419424708323 430.9295111346704Z", "c": [342.4, 421.4] }, { "d": "M349.0892013025372 414.49517459876927L367.0357605792619 414.8202068171507L371.7373717635432 417.78908264327424L373.74945131916166 421.6147897392316L371.55199139809037 424.7842109616667L350.2180762968649 426.42265026199124Z", "c": [357, 420] }, { "d": "M360.9417668550678 404.07006447359095L369.7625857020139 397.5183693155331L375.0409132019242 403.42653767742854L371.7373717635432 417.78908264327424L367.0357605792619 414.8202068171507Z", "c": [367.4, 403.5] }, { "d": "M356.07529505879313 454.0828177311805L379.98712593598555 453.616431923425L375.6317164912361 464.2637193350269L367.1253583555123 466.6653715581016Z", "c": [371.6, 458.8] }, { "d": "M354.7102504696393 452.52846038878636L356.7040424272033 446.5911465843257L368.9696470060441 436.85839956519663L384.98557365223974 449.8020303248826L379.98712593598555 453.616431923425L356.0752950587931 454.08281773118046Z", "c": [371.4, 448.8] }, { "d": "M375.6317164912361 464.2637193350269L379.98712593598555 453.616431923425L384.98557365223974 449.8020303248826L387.9 449.6700270212028L387.9 459.3L389.1 461.7L389.5804564672748 467.0650972179018L383.24888329044364 471.2757111923926Z", "c": [382.4, 463.2] }, { "d": "M369.7625857020139 397.5183693155331L378.4208047957396 391.0874457133093L384.7859023530631 389.91934539234995L384.9 390.1L385.5 393.1L385.7683644025533 397.7069222438309L375.0409132019242 403.42653767742854Z", "c": [376, 395.8] }, { "d": "M368.9696470060441 436.85839956519663L371.55199139809037 424.7842109616667L373.74945131916166 421.6147897392316L387.2996907428169 421.94703628532875L387.9 427.7L390.4 430.7L388.5 432.6L387.9 435.6L387.9 449.6700270212028L384.98557365223974 449.8020303248826Z", "c": [381.2, 436.7] }, { "d": "M347.76412710245097 430.08420220447687L350.2180762968649 426.42265026199124L371.55199139809037 424.7842109616667L368.9696470060441 436.85839956519663L356.7040424272033 446.5911465843257Z", "c": [357.9, 431.8] }, { "d": "M371.7373717635432 417.78908264327424L375.0409132019242 403.42653767742854L385.7683644025533 397.7069222438309L386.1 403.4L387.3 406.4L387 408L384.9 408.3L384.9 412.5L386.7 416.2L387.2996907428169 421.94703628532875L373.74945131916166 421.6147897392316Z", "c": [381.9, 406.9] }, { "d": "M335.7419424708323 430.9295111346704L347.76412710245097 430.08420220447687L356.7040424272033 446.5911465843257L354.7102504696393 452.52846038878636Z", "c": [343.6, 439.5] }, { "d": "M367.1253583555123 466.6653715581016L375.6317164912361 464.2637193350269L383.24888329044364 471.2757111923926L382.28890905911413 474.8L380.9 474.8L379.7 476.6L376.1 476.6L375.2 475.7L375.2 472L372.4 469.9L369.96602564102557 469.9Z", "c": [375.1, 471.1] }, { "d": "M382.28890905911413 474.8L383.24888329044364 471.2757111923926L389.5804564672748 467.0650972179018L389.7 468.4L391.6 473.2L391.6 476.3L394 481.7L390.7 483.3L388.8 485.1L386.1 478.1L386.1 475.7L385.2 474.8Z", "c": [390.4, 475.2] }, { "d": "M348.26681898800734 413.4844279255742L360.9417668550678 404.0700644735909L367.0357605792619 414.8202068171507L349.0892013025372 414.49517459876927Z", "c": [357.2, 409.3] }] }, { "name": "রাঙ্গামাটি", "d": "M319.498075697002 351.09240892282537L321.2725231402125 341.4638498457319L366.87951528773164 317.8202249692549L367.3 326.3L369.7 329.3L368.5 335.4L368.5 340.3L370.6 341.8L371.8 341.8L372.7 343.9L375.2 346.3L375.2 350.6L376.4 352.4L376.4 355.4L379.4 359.7L381.9 368.2L381.9 374.9L383.1 379.1L383.7 388.2L384.7859023530631 389.91934539234995L378.4208047957396 391.0874457133093Z", "c": [354.2, 348.5], "subs": [{ "d": "M331.5628981084486 359.28165988925423L335.95081638157137 354.79187464284763L349.52984711943077 354.84809340306253L353.8207179573713 374.38962140681906Z", "c": [338.2, 361.3] }, { "d": "M354.2180830075626 374.65934125932324L363.05202960181634 370.80976185724455L382.2615180830952 376.1653132908333L382.8985380074959 378.39488302623573L374.0469834394681 388.1186228374043Z", "c": [373.5, 381.3] }, { "d": "M332.0950639551289 346.8890037522248L340.82809960126707 339.8752673136537L346.31361323651436 340.9746227579767L349.7290730492766 354.21801493192146L349.52984711943077 354.84809340306253L335.95081638157137 354.79187464284763Z", "c": [338.3, 348.3] }, { "d": "M349.52984711943077 354.84809340306253L349.7290730492766 354.21801493192146L367.0228405477183 346.44203261681173L369.50279520906923 362.22240388007873L363.05202960181634 370.80976185724455L354.2180830075626 374.6593412593232L353.8207179573713 374.38962140681906Z", "c": [362.5, 356] }, { "d": "M367.0228405477183 346.44203261681173L370.0777171447216 341.42694081765825L370.6 341.8L371.8 341.8L372.7 343.9L375.2 346.3L375.2 350.6L376.4 352.4L376.4 355.4L379.4 359.7L379.4291318975283 359.7990484515962L369.50279520906923 362.22240388007873Z", "c": [374.3, 354.1] }, { "d": "M363.05202960181634 370.80976185724455L369.50279520906923 362.22240388007873L379.4291318975283 359.7990484515962L381.9 368.2L381.9 374.9L382.2615180830952 376.1653132908333Z", "c": [377.5, 367.2] }, { "d": "M319.498075697002 351.09240892282537L320.72769124915504 344.4202327299948L332.0950639551289 346.8890037522248L335.95081638157137 354.79187464284763L331.5628981084486 359.28165988925423Z", "c": [329.4, 352.7] }, { "d": "M374.0469834394681 388.1186228374043L382.8985380074959 378.39488302623573L383.1 379.1L383.7 388.2L384.7859023530631 389.91934539234995L378.4208047957396 391.0874457133093Z", "c": [380.8, 388] }, { "d": "M346.31361323651436 340.9746227579767L351.8088258635536 334.27092621180026L368.5 336.1832439695028L368.5 340.3L370.0777171447216 341.42694081765825L367.0228405477183 346.44203261681173L349.7290730492766 354.21801493192146Z", "c": [356.9, 343.5] }, { "d": "M349.7306288429447 326.7105687314208L366.87951528773164 317.8202249692549L367.3 326.3L369.7 329.3L368.5 335.4L368.5 336.1832439695028L351.8088258635536 334.27092621180026Z", "c": [358.8, 326.4] }, { "d": "M320.72769124915504 344.4202327299948L321.2725231402125 341.4638498457319L335.3069869375694 334.18808835078636L340.82809960126707 339.8752673136537L332.0950639551289 346.8890037522248Z", "c": [332, 340.5] }, { "d": "M335.3069869375694 334.18808835078636L349.7306288429447 326.7105687314207L351.8088258635536 334.27092621180026L346.31361323651436 340.9746227579767L340.82809960126707 339.8752673136537Z", "c": [341.7, 331.1] }] }, { "name": "খাগড়াছড়ি", "d": "M318.1906639004149 335.90933609958506L320.2 333.9L321.4 333.9L322.4 331.8L324.8 329.9L324.2 322.7L322.4 318.4L321.7 314.8L319.3 311.7L319.3 309.9L326 303.8L326.3 301.7L330.5 298.7L333.6 298.7L333.9 296.5L336.3 294.7L335.1 281.4L333.9 277.7L333.9 276.5L335.1 275.3L335.1 272.9L336.3 272.9L336.9 275.9L339 278.6L344.5 278.6L350.6 272L351.8 273.8L353.9 274.7L354.2 276.2L357.9 276.2L358.5 273.2L359.7 273.2L361.2 274.7L360.6 282.6L363 286.2L364.2 296.5L366.1 299L366.7 302.6L368.5 303.8L368.5 308.7L369.7 312.3L369.4 313.2L366.7 314.2L366.87951528773164 317.8202249692549L321.2725231402125 341.4638498457319Z", "c": [334.5, 310.5], "subs": [{ "d": "M332.103261995163 298.7L333.6 298.7L333.9 296.5L336.3 294.7L335.3774032877107 284.4745531054602L340.03621391466345 287.08382692888875L342.1656363298804 302.18168486727524L340.43864749932726 302.8719020366479Z", "c": [336.8, 296] }, { "d": "M350.3597018367938 303.7425267710192L355.8410004258214 287.45432313845447L361.3063945805457 283.65959187081853L363 286.2L364.2 296.5L365.9558639643684 298.81034732153734L359.194387102593 308.996200528833L351.36459968322555 305.3100864912059Z", "c": [359.6, 299.5] }, { "d": "M333.9 276.5L335.1 275.3L335.1 272.9L336.3 272.9L336.9 275.9L339 278.6L344.5 278.6L350.6 272L351.8 273.8L353.9 274.7L354.2 276.2L357.9 276.2L358.5 273.2L359.7 273.2L361.2 274.7L360.6 282.6L361.3063945805457 283.65959187081853L355.8410004258214 287.45432313845447L340.03621391466345 287.08382692888875L335.3774032877107 284.4745531054602L335.1 281.4L333.9 277.7Z", "c": [345.9, 279.7] }, { "d": "M340.03621391466345 287.08382692888875L355.8410004258214 287.45432313845447L350.3597018367938 303.7425267710192L342.1656363298804 302.18168486727524Z", "c": [345.6, 294.7] }, { "d": "M318.1906639004149 335.90933609958506L320.2 333.9L321.4 333.9L322.4 331.8L324.8 329.9L324.4376134526787 325.5513614321445L331.4930125102294 313.96186770874164L334.2510513610025 312.6362132335859L345.6659919211464 316.07795569177034L349.02983550436466 327.0738747516846L321.2725231402125 341.4638498457319Z", "c": [339.9, 319.1] }, { "d": "M345.6659919211464 316.07795569177034L351.36459968322555 305.3100864912059L359.194387102593 308.996200528833L365.56147520538696 318.50352469615467L349.02983550436466 327.0738747516846Z", "c": [352.1, 315.4] }, { "d": "M326.1332736287262 302.8670845989167L326.3 301.7L330.5 298.7L332.103261995163 298.7L340.43864749932726 302.8719020366479L334.2510513610025 312.6362132335859L331.4930125102294 313.96186770874164Z", "c": [332.7, 304.1] }, { "d": "M334.2510513610025 312.6362132335859L340.43864749932726 302.8719020366479L342.1656363298804 302.18168486727524L350.3597018367938 303.7425267710192L351.36459968322555 305.3100864912059L345.6659919211464 316.07795569177034Z", "c": [342.6, 310.4] }, { "d": "M359.194387102593 308.996200528833L365.9558639643684 298.81034732153734L366.1 299L366.7 302.6L368.5 303.8L368.5 308.7L369.7 312.3L369.4 313.2L366.7 314.2L366.87951528773164 317.8202249692549L365.56147520538696 318.50352469615467Z", "c": [367.8, 304.9] }, { "d": "M319.3 309.9L326 303.8L326.1332736287262 302.8670845989167L331.4930125102294 313.96186770874164L324.4376134526787 325.5513614321445L324.2 322.7L322.4 318.4L321.7 314.8L319.3 311.7Z", "c": [323, 308.8] }] }];

  // geo.js
  var outlinePath = OUTLINE;
  var used =  new Map();
  var subOf =  new Map();
  var CELLS = DISTRICT_SHAPES.map((d) => {
    const subs = d.subs.map((s) => ({ path: s.d, c: s.c }));
    const here = PLACES.filter((p) => p.district === d.name);
    here.forEach((p) => {
      const i = used.get(d.name) ?? 0;
      used.set(d.name, i + 1);
      const s = subs.length ? subs[i * 3 % subs.length] : void 0;
      if (s)
        s.place = p;
      subOf.set(p.id, s ? s.c : d.c);
    });
    const first = here[0];
    return { key: d.name, path: d.d, c: d.c, subs, place: first, flooded: here.some((p) => p.flooded) };
  });
  var pos = (p) => subOf.get(p.id) ?? [W / 2, H / 2];

  // BangladeshMap.js
  function BangladeshMap({ tall = false }) {
    const { tr } = languageContext();
    const [mode, setMode] = stateValue("ok");
    const [scale, setScale] = stateValue(1);
    const [center, setCenter] = stateValue([W / 2, H / 2]);
    const [sel, setSel] = stateValue(null);
    const [emptyPick, setEmptyPick] = stateValue(false);
    const [q, setQ] = stateValue("");
    const [hover, setHover] = stateValue(null);
    const places = mode === "empty" ? [] : PLACES;
    const results = calculate(() => q.trim() ? PLACES.filter((p) => matchesSearch(`${p.upazila}, ${p.district}`, q)) : [], [q]);
    const vw = W / scale, vh = H / scale;
    const x0 = Math.min(Math.max(center[0] - vw / 2, 0), W - vw), y0 = Math.min(Math.max(center[1] - vh / 2, 0), H - vh);
    const pick = (p, zoom2 = true) => {
      setSel(p);
      setEmptyPick(false);
      if (zoom2) {
        setScale(2.4);
        setCenter(pos(p));
      }
    };
    const reset = () => {
      setScale(1);
      setCenter([W / 2, H / 2]);
      setSel(null);
      setEmptyPick(false);
      setQ("");
    };
    const zoom = (f) => setScale((s) => Math.min(5, Math.max(1, s * f)));
    const placeKey = (p) => places.find((x) => x.id === p.id);
    return node(
      "div",
      { className: "shara-137 shara-141 shara-150 shara-169 shara-195 shara-235", __site: "BangladeshMap-1699" },
      node(
        "div",
        { className: "shara-044 shara-103 shara-106 shara-116 shara-156 shara-169 shara-201", __site: "BangladeshMap-1816" },
        node(
          "div",
          { className: "shara-003 shara-093 shara-095", __site: "BangladeshMap-1901" },
          node(Search, { size: 18, className: "shara-002 shara-010 shara-006 shara-097 shara-270", __site: "BangladeshMap-1959" }),
          node("input", { value: q, onChange: (e) => setQ(e.target.value), "aria-label": tr("জেলা বা উপজেলা খুঁজুন"), placeholder: tr("জেলা বা উপজেলার নাম লিখুন"), className: "shara-070 shara-078 shara-142 shara-150 shara-159 shara-232 shara-229", __site: "BangladeshMap-2057" }),
          q.trim() && node(
            "ul",
            { className: "shara-002 shara-012 shara-022 shara-078 shara-142 shara-150 shara-169 shara-195 shara-199 shara-286", __site: "BangladeshMap-2305" },
            results.length === 0 && node("li", { className: "shara-210 shara-216 shara-242 shara-270", __site: "BangladeshMap-2456" }, tr("কোনো এলাকা পাওয়া যায়নি")),
            results.map((p) => node(
              "li",
              { key: p.id, __site: "BangladeshMap-2579" },
              node(
                "button",
                { onClick: () => {
                  pick(p);
                  setQ("");
                }, className: "shara-044 shara-069 shara-078 shara-106 shara-114 shara-145 shara-210 shara-234 shara-304", __site: "BangladeshMap-2611" },
                node(MapPin, { size: 15, className: "shara-264", __site: "BangladeshMap-2749" }),
                tr(p.upazila),
                node(
                  "span",
                  { className: "shara-242 shara-270", __site: "BangladeshMap-2807" },
                  "· ",
                  tr(p.district)
                )
              )
            ))
          )
        ),
        node(
          "div",
          { className: "shara-044 shara-106 shara-114", role: "group", "aria-label": tr("মানচিত্র নিয়ন্ত্রণ"), __site: "BangladeshMap-2959" },
          node(
            Button,
            { variant: "secondary", "aria-label": tr("বড় করুন"), onClick: () => zoom(1.5), className: "shara-206 shara-076", __site: "BangladeshMap-3063" },
            node(Plus, { size: 18, __site: "BangladeshMap-3168" })
          ),
          node(
            Button,
            { variant: "secondary", "aria-label": tr("ছোট করুন"), onClick: () => zoom(1 / 1.5), className: "shara-206 shara-076", __site: "BangladeshMap-3206" },
            node(Minus, { size: 18, __site: "BangladeshMap-3315" })
          ),
          node(
            Button,
            { variant: "secondary", onClick: reset, __site: "BangladeshMap-3354" },
            node(RotatecwIcon, { __site: "BangladeshMap-3398" }),
            tr("আগের অবস্থায়")
          )
        )
      ),
      node(
        "div",
        { className: "shara-045 shara-360", __site: "BangladeshMap-3480" },
        node(
          "div",
          { className: "shara-003 shara-179", __site: "BangladeshMap-3536" },
          node(
            "div",
            { className: `shara-017 shara-078 ${tall ? "shara-086" : "shara-085"} shara-212 shara-218`, __site: "BangladeshMap-3586" },
            mode === "loading" && node(
              "div",
              { className: "shara-045 shara-050 shara-104", __site: "BangladeshMap-3709" },
              node(Spinner, { label: tr("মানচিত্রের তথ্য লোড হচ্ছে..."), __site: "BangladeshMap-3768" })
            ),
            mode === "error" && node(
              "div",
              { className: "shara-045 shara-050 shara-104 shara-203", __site: "BangladeshMap-3864" },
              node(
                "div",
                { className: "shara-091", __site: "BangladeshMap-3958" },
                node(Alert, { kind: "error", title: tr("মানচিত্রের তথ্য আনা যায়নি"), __site: "BangladeshMap-3984" }, tr("ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন। আপনি চাইলে মানচিত্র ছাড়াই আবেদন করতে পারেন।")),
                node(
                  "div",
                  { className: "shara-025 shara-044 shara-114", __site: "BangladeshMap-4163" },
                  node(Button, { size: "sm", onClick: () => setMode("ok"), __site: "BangladeshMap-4196" }, tr("আবার চেষ্টা করুন")),
                  node(Button, { size: "sm", variant: "secondary", to: "/apply", __site: "BangladeshMap-4277" }, tr("আবেদন করুন"))
                )
              )
            ),
            (mode === "ok" || mode === "empty") && node(
              "svg",
              { viewBox: `${x0} ${y0} ${vw} ${vh}`, className: "shara-078", role: "img", "aria-label": tr("বাংলাদেশের মানচিত্র"), __site: "BangladeshMap-4456" },
              node(
                "defs",
                { __site: "BangladeshMap-4598" },
                node(
                  "clipPath",
                  { id: "bd", __site: "BangladeshMap-4604" },
                  node("path", { d: outlinePath, __site: "BangladeshMap-4622" })
                )
              ),
              node("path", { d: outlinePath, fill: "#e9eee9", __site: "BangladeshMap-4681" }),
              node(
                "g",
                { clipPath: "url(#bd)", __site: "BangladeshMap-4737" },
                CELLS.map((c) => node(
                  "g",
                  { key: c.key, __site: "BangladeshMap-4798" },
                  node("path", { d: c.path, fill: c.flooded && mode === "ok" ? "#fdebc8" : "#f4f7f4", __site: "BangladeshMap-4857" }),
                  c.subs.map((s, i) => node("path", { key: i, d: s.path, fill: s.place?.flooded && mode === "ok" ? "#f8c978" : "none", stroke: "#cfd8d1", strokeWidth: 0.35 / Math.sqrt(scale), __site: "BangladeshMap-4980" }))
                )),
                CELLS.map((c) => node("path", { key: "d" + c.key, d: c.path, fill: hover === c.key ? "rgba(46,107,79,.12)" : "transparent", stroke: "#6f8a7a", strokeWidth: 0.9 / Math.sqrt(scale), className: "shara-099", onMouseEnter: () => setHover(c.key), onMouseLeave: () => setHover(null), onClick: () => {
                  const p = mode === "ok" ? c.subs.find((s) => s.place)?.place : void 0;
                  if (p)
                    pick(p, false);
                  else {
                    setSel(null);
                    setEmptyPick(true);
                  }
                }, __site: "BangladeshMap-5260" }))
              ),
              node("path", { d: outlinePath, fill: "none", stroke: "#12372a", strokeWidth: 1.5 / Math.sqrt(scale), strokeLinejoin: "round", pointerEvents: "none", __site: "BangladeshMap-5798" }),
              scale > 1.4 && CELLS.map((c) => node("text", { key: "t" + c.key, x: c.c[0], y: c.c[1], textAnchor: "middle", fontSize: 5 / Math.sqrt(scale / 1.4), fill: "#12372a", fontWeight: 600, paintOrder: "stroke", stroke: "#f8faf8", strokeWidth: 1.6, pointerEvents: "none", __site: "BangladeshMap-5983" }, tr(c.key))),
              places.map((p) => {
                const [x, y] = pos(p);
                const on = sel?.id === p.id;
                const r = (3.6 + Math.min(p.requests, 20) * 0.12) / Math.sqrt(scale);
                return node(
                  "g",
                  { key: p.id, className: "shara-099", onClick: () => pick(p, false), role: "button", tabIndex: 0, "aria-label": tr(`${p.upazila}, ${bn(p.requests)}টি আবেদন`), onKeyDown: (e) => e.key === "Enter" && pick(p, false), __site: "BangladeshMap-6489" },
                  p.status.pending > 0 && node("circle", { cx: x, cy: y, r, fill: "#dc2626", className: "shara-375", __site: "BangladeshMap-6770" }),
                  on && node("circle", { cx: x, cy: y, r: r + 3 / Math.sqrt(scale), fill: "none", stroke: "#12372a", strokeWidth: 1.2 / Math.sqrt(scale), __site: "BangladeshMap-6869" }),
                  node("circle", { cx: x, cy: y, r, fill: "#dc2626", stroke: "#fff", strokeWidth: 1.2 / Math.sqrt(scale), __site: "BangladeshMap-7013" })
                );
              })
            )
          ),
          node(
            "div",
            { className: "shara-002 shara-010 shara-007 shara-046 shara-102 shara-112 shara-145 shara-150 shara-169 shara-196 shara-199 shara-244 shara-270 shara-323", role: "group", "aria-label": tr("মানচিত্রের অবস্থা পরিবর্তন"), __site: "BangladeshMap-7239" },
            node("span", { className: "shara-208 shara-224 shara-255", __site: "BangladeshMap-7448" }, tr("মানচিত্রের অবস্থা")),
            [["ok", "স্বাভাবিক"], ["loading", "লোড হচ্ছে"], ["error", "ত্রুটি"], ["empty", "আবেদন নেই"]].map(([m, l]) => node("button", { key: m, onClick: () => {
              setMode(m);
              if (m === "loading")
                setTimeout(() => setMode("ok"), 1500);
            }, "aria-pressed": mode === m, className: `shara-140 shara-208 shara-215 shara-234 ${mode === m ? "shara-184 shara-279" : "shara-304"}`, __site: "BangladeshMap-7668" }, tr(l)))
          )
        ),
        node(
          "aside",
          { className: "shara-154 shara-169 shara-204 shara-365 shara-364", "aria-live": "polite", __site: "BangladeshMap-7989" },
          node(Legend, { __site: "BangladeshMap-8089" }),
          node(
            "div",
            { className: "shara-027 shara-154 shara-169 shara-226", __site: "BangladeshMap-8110" },
            node(Detail, { p: sel && placeKey(sel) ? sel : null, emptyPick, mode, __site: "BangladeshMap-8171" })
          )
        )
      )
    );
  }
  var RotatecwIcon = () => node(RotateCcw, { size: 16, __site: "BangladeshMap-8345" });
  function Legend() {
    const { tr } = languageContext();
    return node(
      "div",
      { __site: "BangladeshMap-8443" },
      node("h3", { className: "shara-035 shara-242 shara-255 shara-280 shara-256 shara-270", __site: "BangladeshMap-8460" }, tr("সংকেত")),
      node(
        "ul",
        { className: "shara-122 shara-247", __site: "BangladeshMap-8566" },
        node(
          "li",
          { className: "shara-044 shara-106 shara-116", __site: "BangladeshMap-8615" },
          node(
            "span",
            { className: "shara-045 shara-054 shara-104", __site: "BangladeshMap-8655" },
            node("span", { className: "shara-053 shara-144 shara-152 shara-173 shara-181 shara-284 shara-288 shara-290", __site: "BangladeshMap-8704" })
          ),
          tr("সাহায্যের আবেদন রয়েছে")
        ),
        node(
          "li",
          { className: "shara-044 shara-106 shara-116", __site: "BangladeshMap-8856" },
          node("span", { className: "shara-054 shara-140 shara-150 shara-162 shara-180", __site: "BangladeshMap-8896" }),
          tr("যাচাইকৃত বন্যাকবলিত এলাকা")
        ),
        node(
          "li",
          { className: "shara-044 shara-106 shara-116", __site: "BangladeshMap-9015" },
          node("span", { className: "shara-054 shara-140 shara-150 shara-161 shara-178", __site: "BangladeshMap-9055" }),
          tr("বর্তমানে যাচাইকৃত বন্যা-সংক্রান্ত তথ্য নেই")
        )
      ),
      node("p", { className: "shara-025 shara-242 shara-270", __site: "BangladeshMap-9201" }, tr("আবেদন থাকা মানেই পুরো উপজেলা বন্যাকবলিত নয়। আবেদন ও যাচাইকৃত বন্যার তথ্য আলাদা স্তর।"))
    );
  }
  function Detail({ p, emptyPick, mode }) {
    const { tr } = languageContext();
    if (mode === "empty")
      return node(Empty, { icon: node(MapPin, { size: 22, __site: "BangladeshMap-9533" }), title: tr("এখনো কোনো আবেদন নেই"), __site: "BangladeshMap-9519" }, tr("নতুন আবেদন এলে এখানে এলাকাভিত্তিক সারসংক্ষেপ দেখা যাবে।"));
    if (!p)
      return emptyPick ? node(Empty, { icon: node(MapPin, { size: 22, __site: "BangladeshMap-9715" }), title: tr("এই এলাকায় কোনো আবেদন নেই"), __site: "BangladeshMap-9695" }, tr("অন্য এলাকা বেছে নিন, অথবা আপনি বিপদে থাকলে আবেদন করুন।")) : node(
        "div",
        { className: "shara-270", __site: "BangladeshMap-9857" },
        node("p", { className: "shara-255 shara-269", __site: "BangladeshMap-9895" }, tr("একটি এলাকা বেছে নিন")),
        node("p", { className: "shara-022 shara-247", __site: "BangladeshMap-9964" }, tr("মানচিত্রে লাল চিহ্নে ক্লিক করুন অথবা উপরে নাম লিখে খুঁজুন।"))
      );
    const s = p.status;
    const rows = [["অপেক্ষমাণ", s.pending, "#f59e0b"], ["যাচাইধীন", s.verifying, "#8a968e"], ["সাহায্য চলমান", s.ongoing, "#2e6b4f"], ["সম্পন্ন", s.done, "#12372a"]];
    return node(
      "div",
      { __site: "BangladeshMap-10302" },
      node(
        "p",
        { className: "shara-242 shara-270", __site: "BangladeshMap-10319" },
        tr(p.district),
        " ",
        tr(" জেলা")
      ),
      node("h3", { className: "shara-236 shara-237 shara-251 shara-267", __site: "BangladeshMap-10397" }, tr(p.upazila)),
      node("div", { className: "shara-024", __site: "BangladeshMap-10484" }, p.flooded ? node(Badge, { s: "pending", __site: "BangladeshMap-10518" }, tr("যাচাইকৃত বন্যাকবলিত")) : node(Badge, { s: "neutral", __site: "BangladeshMap-10575" }, tr("যাচাইকৃত বন্যার তথ্য নেই"))),
      node(
        "div",
        { className: "shara-026 shara-044 shara-105 shara-114", __site: "BangladeshMap-10649" },
        node("span", { className: "shara-236 shara-239 shara-251 shara-264", __site: "BangladeshMap-10697" }, tr(bn(p.requests))),
        node("span", { className: "shara-270", __site: "BangladeshMap-10785" }, tr("টি সাহায্যের আবেদন"))
      ),
      node(
        "div",
        { className: "shara-026", __site: "BangladeshMap-10863" },
        node("p", { className: "shara-033 shara-242 shara-255 shara-270", __site: "BangladeshMap-10885" }, tr("প্রয়োজনীয় সহায়তা")),
        node("div", { className: "shara-044 shara-103 shara-113", __site: "BangladeshMap-10974" }, p.categories.map((c) => node("span", { key: c, className: "shara-146 shara-187 shara-208 shara-214 shara-242 shara-267", __site: "BangladeshMap-11038" }, tr(c))))
      ),
      node(
        "div",
        { className: "shara-026", __site: "BangladeshMap-11151" },
        node("p", { className: "shara-033 shara-242 shara-255 shara-270", __site: "BangladeshMap-11182" }, tr("আবেদনের অবস্থা (মোট)")),
        node("div", { className: "shara-034 shara-044 shara-063 shara-137 shara-144 shara-190", __site: "BangladeshMap-11281" }, rows.map(([l, n, c]) => node("span", { key: l, style: { width: `${n / p.requests * 100}%`, background: c }, title: tr(l), __site: "BangladeshMap-11382" }))),
        node("ul", { className: "shara-045 shara-100 shara-129 shara-131 shara-242", __site: "BangladeshMap-11493" }, rows.map(([l, n, c]) => node(
          "li",
          { key: l, className: "shara-044 shara-106 shara-114", __site: "BangladeshMap-11574" },
          node("span", { className: "shara-052 shara-147", style: { background: c }, __site: "BangladeshMap-11623" }),
          tr(l),
          node("b", { className: "shara-041", __site: "BangladeshMap-11696" }, tr(bn(n)))
        )))
      ),
      node(
        "p",
        { className: "shara-026 shara-044 shara-114 shara-145 shara-191 shara-201 shara-242 shara-270", __site: "BangladeshMap-11766" },
        node(ShieldCheck, { size: 18, className: "shara-021 shara-096 shara-271", __site: "BangladeshMap-11843" }),
        tr("গোপনীয়তার জন্য নাম, ফোন নম্বর ও সঠিক ঠিকানা এখানে দেখানো হয় না।")
      ),
      node(Link, { to: `/apply?district=${encodeURIComponent(p.district)}&upazila=${encodeURIComponent(p.upazila)}`, className: "shara-026 shara-047 shara-070 shara-078 shara-106 shara-110 shara-142 shara-184 shara-255 shara-279 shara-302", __site: "BangladeshMap-11990" }, tr("এই এলাকায় সাহায্যের আবেদন"))
    );
  }

  // Home.js
  var steps = [
    [FilePenLine, "সাহায্যের আবেদন জানান", "অ্যাকাউন্ট ছাড়াই কয়েকটি তথ্য দিয়ে আবেদন পাঠান।"],
    [ClipboardCheck, "আবেদন যাচাই করা হয়", "প্রশাসকরা তথ্য যাচাই করে অগ্রাধিকার ঠিক করেন।"],
    [
      Users,
      "উপযুক্ত স্বেচ্ছাসেবক দল নির্ধারণ করা হয়",
      "এলাকা ও সক্ষমতা দেখে সবচেয়ে কাছের দল বেছে নেওয়া হয়।"
    ],
    [Truck, "সহায়তা পৌঁছে দেওয়া হয়", "দলটি সহায়তা পৌঁছে কার্যক্রমের অবস্থা হালনাগাদ করে।"]
  ];
  function Home() {
    const { tr } = languageContext();
    const s = demoState();
    const metrics = [
      ["মোট সাহায্যের আবেদন", s.requests.length],
      [
        "যাচাইধীন আবেদন",
        s.requests.filter((r) => ["pending", "clarification"].includes(r.verification)).length
      ],
      ["সাহায্য চলমান", s.missions.filter(active).length],
      ["সহায়তা সম্পন্ন", s.missions.filter((m) => m.status === "done").length]
    ];
    return node(
      fragment,
      null,
      node(
        "section",
        { className: "shara-156 shara-169 shara-191", __site: "Home-1320" },
        node(
          "div",
          { className: "shara-017 shara-045 shara-084 shara-106 shara-120 shara-212 shara-222 shara-333 shara-357 shara-367", __site: "Home-1380" },
          node(
            "div",
            { __site: "Home-1504" },
            node(
              "p",
              { className: "shara-036 shara-047 shara-106 shara-114 shara-144 shara-187 shara-210 shara-215 shara-242 shara-253 shara-267", __site: "Home-1522" },
              node(UserX, { size: 16, __site: "Home-1651" }),
              tr("কোনো অ্যাকাউন্ট বা নিবন্ধন ছাড়াই আবেদন করা যায়")
            ),
            node("h1", { className: "shara-236 shara-245 shara-252 shara-248 shara-267 shara-341 shara-342", __site: "Home-1758" }, tr("দুর্যোগে, মানুষের পাশে মানুষ")),
            node("p", { className: "shara-027 shara-090 shara-243 shara-249 shara-270", __site: "Home-1941" }, tr("বন্যায় আটকে পড়েছেন? আপনার বা অন্য কারও সাহায্যের আবেদন জানান।")),
            node(
              "div",
              { className: "shara-030 shara-044 shara-102 shara-116 shara-330", __site: "Home-2111" },
              node(
                Button,
                { to: "/apply", size: "lg", className: "shara-175 shara-243 shara-300 shara-327", __site: "Home-2180" },
                tr("সাহায্যের আবেদন করুন "),
                node(ArrowRight, { size: 22, __site: "Home-2384" })
              ),
              node(Button, { to: "/map", size: "lg", variant: "secondary", __site: "Home-2447" }, tr("বন্যা পরিস্থিতি দেখুন"))
            ),
            node(
              "p",
              { className: "shara-026 shara-044 shara-106 shara-114 shara-242 shara-270", __site: "Home-2582" },
              node(ShieldCheck, { size: 16, className: "shara-271", __site: "Home-2663" }),
              tr("জনসমক্ষে নাম/ফোন দেখানো হয় না।")
            ),
            node(
              Button,
              { to: "/track", variant: "ghost", className: "shara-025", __site: "Home-2781" },
              tr("আগের আবেদন ট্র্যাক করুন "),
              node(ArrowRight, { size: 16, __site: "Home-2881" })
            )
          ),
          node(
            "figure",
            { className: "shara-003", __site: "Home-2955" },
            node(
              "div",
              { className: "shara-049 shara-137 shara-143 shara-187", __site: "Home-2997" },
              node("img", { src: "/static/assets/images/flood-response.jpg", alt: tr("বন্যার পানিতে নৌকায় দুজন মানুষ"), className: "shara-062 shara-198", loading: "eager", __site: "Home-3081" })
            ),
            node(
              "div",
              { className: "shara-002 shara-009 shara-011 shara-008 shara-044 shara-106 shara-116 shara-148 shara-150 shara-169 shara-195 shara-203 shara-287 shara-319 shara-326", __site: "Home-3340" },
              node(
                "span",
                { className: "shara-045 shara-055 shara-096 shara-104 shara-144 shara-187 shara-271", __site: "Home-3508" },
                node(HandHeart, { size: 20, __site: "Home-3615" })
              ),
              node("p", { className: "shara-247 shara-250 shara-269", __site: "Home-3675" }, tr("স্থানীয় স্বেচ্ছাসেবক দলের মাধ্যমে সহায়তা সমন্বয় করা হয়"))
            )
          )
        )
      ),
      node(
        "section",
        { id: "map", className: "shara-017 shara-084 shara-212 shara-223 shara-333", __site: "Home-3890" },
        node(
          "div",
          { className: "shara-039 shara-079", __site: "Home-3966" },
          node("h2", { className: "shara-235 shara-238 shara-251 shara-267 shara-339", __site: "Home-4009" }, tr("বাংলাদেশের কোথায় সাহায্য প্রয়োজন?")),
          node("p", { className: "shara-024 shara-235 shara-241 shara-270", __site: "Home-4172" }, tr("জেলা ও উপজেলা অনুযায়ী সাহায্যের আবেদন দেখুন এবং মানবিক সহায়তায় এগিয়ে আসুন।"))
        ),
        node(BangladeshMap, { __site: "Home-4373" }),
        node(
          "div",
          { className: "shara-026 shara-044 shara-103 shara-106 shara-130 shara-133 shara-235", __site: "Home-4399" },
          node(Button, { to: "/apply", className: "shara-175 shara-300", __site: "Home-4508" }, tr("সাহায্যের আবেদন জানান")),
          node(
            Link,
            { to: "/map", className: "shara-047 shara-106 shara-114 shara-255 shara-267 shara-281 shara-282", __site: "Home-4630" },
            tr("পূর্ণ পর্দায় মানচিত্র দেখুন "),
            node(ArrowRight, { size: 16, __site: "Home-4829" })
          )
        )
      ),
      node(
        "section",
        { className: "shara-153 shara-169 shara-189", __site: "Home-4911" },
        node(
          "div",
          { className: "shara-017 shara-084 shara-212 shara-222 shara-333", __site: "Home-4973" },
          node(
            "div",
            { className: "shara-038 shara-044 shara-103 shara-105 shara-109 shara-114", __site: "Home-5038" },
            node("h2", { className: "shara-236 shara-237 shara-251 shara-267", __site: "Home-5125" }, tr("জরুরি পরিস্থিতির সারসংক্ষেপ"))
          ),
          node("dl", { className: "shara-045 shara-100 shara-121 shara-137 shara-148 shara-150 shara-169 shara-186 shara-356", __site: "Home-5268" }, metrics.map(([l, n]) => node(
            "div",
            { key: l, className: "shara-195 shara-204 shara-331", __site: "Home-5416" },
            node("dt", { className: "shara-270", __site: "Home-5493" }, tr(l)),
            node("dd", { className: "shara-022 shara-236 shara-239 shara-251 shara-267 shara-340", __site: "Home-5552" }, tr(bn(n)))
          )))
        )
      ),
      node(
        "section",
        { className: "shara-017 shara-084 shara-212 shara-223 shara-333", __site: "Home-5774" },
        node("h2", { className: "shara-236 shara-238 shara-251 shara-267 shara-339", __site: "Home-5841" }, tr("SHARA কীভাবে কাজ করে")),
        node("ol", { className: "shara-031 shara-045 shara-119 shara-345", __site: "Home-5966" }, steps.map(([Icon, t, d], i) => node(
          "li",
          { key: t, className: "shara-003 shara-155 shara-164 shara-226", __site: "Home-6058" },
          node(
            "span",
            { className: "shara-236 shara-242 shara-251 shara-271", __site: "Home-6149" },
            tr("ধাপ "),
            tr(bn(i + 1))
          ),
          node(
            "span",
            { className: "shara-025 shara-045 shara-057 shara-104 shara-148 shara-187 shara-267", __site: "Home-6289" },
            node(Icon, { size: 24, __site: "Home-6392" })
          ),
          node("h3", { className: "shara-026 shara-241 shara-251 shara-250", __site: "Home-6447" }, tr(t)),
          node("p", { className: "shara-023 shara-270", __site: "Home-6526" }, tr(d))
        )))
      ),
      node(
        "section",
        { className: "shara-184 shara-279", __site: "Home-6644" },
        node(
          "div",
          { className: "shara-017 shara-045 shara-084 shara-106 shara-119 shara-212 shara-223 shara-333 shara-359", __site: "Home-6695" },
          node(
            "div",
            { __site: "Home-6809" },
            node("h2", { className: "shara-236 shara-238 shara-251 shara-250 shara-339", __site: "Home-6827" }, tr("আপনার সহযোগিতা হতে পারে কারও বেঁচে থাকার আশার আলো")),
            node("p", { className: "shara-025 shara-090 shara-241 shara-263", __site: "Home-6990" }, tr("আপনার এলাকার মানুষের পাশে দাঁড়াতে স্বেচ্ছাসেবক হিসেবে যুক্ত হোন।"))
          ),
          node(
            "div",
            { className: "shara-044 shara-102 shara-116 shara-330 shara-362", __site: "Home-7162" },
            node(Button, { to: "/volunteer/register", size: "lg", className: "shara-177 shara-261 shara-299", __site: "Home-7236" }, tr("স্বেচ্ছাসেবক হিসেবে নিবন্ধন")),
            node(Button, { to: "/organization/register", size: "lg", className: "shara-149 shara-158 shara-176 shara-279 shara-301", __site: "Home-7456" }, tr("সংগঠন হিসেবে নিবন্ধন"))
          )
        )
      )
    );
  }

  // entry.js
  setPageContent(() => node(Home, { "__site": "page-content" }));
  mountPage(() => node(PublicLayout, { "__site": "page-layout" }));
})();
