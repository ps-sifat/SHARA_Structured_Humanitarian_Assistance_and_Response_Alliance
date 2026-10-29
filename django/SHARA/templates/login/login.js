/* SHARA login: native DOM and browser-local interactions. No frontend runtime dependencies. */
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
  function queryParameters() {
    return [new URLSearchParams(window.location.search), (values, options = {}) => {
      const search = new URLSearchParams(values).toString();
      window.history[options.replace ? "replaceState" : "pushState"]({}, "", window.location.pathname + (search ? "?" + search : ""));
      refresh();
    }];
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
  function X({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#x" }), children);
  }
  function Users({ size = 24, children, ...props } = {}) {
    return node("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props }, node("use", { href: "/static/assets/icons/shara.svg#users" }), children);
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
  function Field({ label, required, hint, error, children, htmlFor }) {
    const { tr } = languageContext();
    return node(
      "div",
      { className: "shara-044 shara-102 shara-113", __site: "ui-4072" },
      node(
        "label",
        { htmlFor, className: "shara-247 shara-255 shara-269", __site: "ui-4123" },
        tr(label),
        " ",
        required ? node("span", { className: "shara-264", "aria-label": tr("আবশ্যক"), __site: "ui-4242" }, "*") : node("span", { className: "shara-242 shara-254 shara-270", __site: "ui-4354" }, tr("(ঐচ্ছিক)"))
      ),
      children,
      hint && !error && node("p", { className: "shara-242 shara-270", __site: "ui-4508" }, tr(hint)),
      error && node(
        "p",
        { role: "alert", className: "shara-044 shara-106 shara-113 shara-242 shara-253 shara-264", __site: "ui-4579" },
        node(AlertTriangle, { size: 15, __site: "ui-4713" }),
        tr(error)
      )
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
  function PageHead({ title, sub, action }) {
    const { tr } = languageContext();
    return node(
      "div",
      { className: "shara-038 shara-044 shara-103 shara-107 shara-109 shara-116", __site: "ui-15863" },
      node(
        "div",
        { __site: "ui-15944" },
        node("h1", { className: "shara-236 shara-237 shara-251 shara-267 shara-338", __site: "ui-15958" }, tr(title)),
        sub && node("p", { className: "shara-022 shara-270", __site: "ui-16082" }, tr(sub))
      ),
      action
    );
  }
  var Card = ({ children, className = "" }) => node("section", { className: `shara-148 shara-150 shara-169 shara-195 shara-204 ${className}`, __site: "ui-16286" }, children);
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

  // PublicFlow.js
  function DemoLogin() {
    const { tr } = languageContext();
    const s = demoState(), nav = navigation(), [params] = queryParameters();
    const [selected, setSelected] = stateValue(s.sessionId ?? "a-v1");
    const login = () => {
      const a = s.accounts.find((x) => x.id === selected);
      if (!a)
        return;
      act({ type: "login", id: selected });
      const root = `/${a.role}`, next = params.get("next") ?? "";
      nav(next === root || next.startsWith(`${root}/`) ? next : root);
    };
    return node(
      "div",
      { className: "shara-017 shara-090 shara-212 shara-222", __site: "PublicFlow-887" },
      node(PageHead, { title: tr("লগইন"), sub: tr("একটি অ্যাকাউন্ট বেছে নিন"), __site: "PublicFlow-944" }),
      node(
        Card,
        { __site: "PublicFlow-1019" },
        node(
          "form",
          { className: "shara-125", onSubmit: (e) => {
            e.preventDefault();
            login();
          }, __site: "PublicFlow-1034" },
          node(
            Field,
            { label: tr("অ্যাকাউন্ট"), required: true, htmlFor: "demo-account", __site: "PublicFlow-1185" },
            node(Select, { id: "demo-account", value: selected, onChange: (e) => setSelected(e.target.value), __site: "PublicFlow-1262" }, s.accounts.map((a) => node(
              "option",
              { key: a.id, value: a.id, __site: "PublicFlow-1445" },
              a.name,
              " —",
              " ",
              tr(a.role === "admin" ? "সুপার অ্যাডমিন" : a.role === "org" ? "সংগঠন প্রশাসক" : "স্বেচ্ছাসেবক")
            )))
          ),
          node(Button, { type: "submit", className: "shara-078", __site: "PublicFlow-1824" }, tr("প্রবেশ করুন")),
          node(
            "div",
            { className: "shara-044 shara-103 shara-116", __site: "PublicFlow-1917" },
            node(Button, { to: "/volunteer/register", variant: "ghost", __site: "PublicFlow-1968" }, tr("স্বেচ্ছাসেবক নিবন্ধন")),
            node(Button, { to: "/organization/register", variant: "ghost", __site: "PublicFlow-2082" }, tr("সংগঠন নিবন্ধন"))
          )
        )
      )
    );
  }

  // entry.js
  setPageContent(() => node(DemoLogin, { "__site": "page-content" }));
  mountPage(() => node(PublicLayout, { "__site": "page-layout" }));
})();
