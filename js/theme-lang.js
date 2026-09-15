/* =========================================================
   DARUL AMAN ACADEMY — THEME (DARK/LIGHT) + LANGUAGE SWITCH
   ========================================================= */

(function () {
    "use strict";

    /* ---------- 1. THEME: applied immediately to avoid flash ---------- */
    var savedTheme = localStorage.getItem("da-theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);

    var savedLang = localStorage.getItem("da-lang") || "bn";
    document.documentElement.setAttribute("lang", savedLang === "bn" ? "bn" : (savedLang === "ar" ? "ar" : "en"));
    if (savedLang === "ar") {
        document.documentElement.setAttribute("dir", "rtl");
    }

    /* ---------- 2. TRANSLATION DICTIONARY (menu / button / heading labels) ---------- */
    var DICT = {
        "Home": { bn: "হোম", en: "Home", ar: "الرئيسية" },
        "Director Zone": { bn: "পরিচালক জোন", en: "Director Zone", ar: "منطقة المدير" },
        "Teaching Garden": { bn: "শিক্ষা বাগান", en: "Teaching Garden", ar: "حديقة التعليم" },
        "Learning Garden": { bn: "শিক্ষা বাগান", en: "Learning Garden", ar: "حديقة التعلم" },
        "Students": { bn: "শিক্ষার্থী", en: "Students", ar: "الطلاب" },
        "Student Fees": { bn: "শিক্ষার্থী ফি", en: "Student Fees", ar: "رسوم الطلاب" },
        "Residential": { bn: "আবাসিক", en: "Residential", ar: "سكني" },
        "Activities": { bn: "কার্যক্রম", en: "Activities", ar: "الأنشطة" },
        "Exam Result": { bn: "পরীক্ষার ফলাফল", en: "Exam Result", ar: "نتيجة الامتحان" },
        "Exam Result Check": { bn: "পরীক্ষার ফলাফল দেখুন", en: "Exam Result Check", ar: "التحقق من النتيجة" },
        "Result": { bn: "ফলাফল", en: "Result", ar: "النتيجة" },
        "Admission": { bn: "ভর্তি", en: "Admission", ar: "القبول" },
        "Apply For Admission": { bn: "ভর্তির জন্য আবেদন", en: "Apply For Admission", ar: "التقدم للقبول" },
        "Apply Now": { bn: "আবেদন করুন", en: "Apply Now", ar: "قدم الآن" },
        "Online Admisson": { bn: "অনলাইন ভর্তি", en: "Online Admission", ar: "القبول عبر الإنترنت" },
        "Tahfiz": { bn: "তাহফিজ", en: "Tahfiz", ar: "التحفيظ" },
        "Tahfiz Department": { bn: "তাহফিজ বিভাগ", en: "Tahfiz Department", ar: "قسم التحفيظ" },
        "Academic": { bn: "একাডেমিক", en: "Academic", ar: "أكاديمي" },
        "Academy Department": { bn: "একাডেমিক বিভাগ", en: "Academy Department", ar: "القسم الأكاديمي" },
        "Best Students": { bn: "সেরা শিক্ষার্থী", en: "Best Students", ar: "أفضل الطلاب" },
        "Ex Students": { bn: "প্রাক্তন শিক্ষার্থী", en: "Ex Students", ar: "الطلاب الخريجون" },
        "EX-Students": { bn: "প্রাক্তন শিক্ষার্থী", en: "EX-Students", ar: "الطلاب الخريجون" },
        "Madrasah Details": { bn: "মাদরাসার তথ্য", en: "Madrasah Details", ar: "تفاصيل المدرسة" },
        "About Us": { bn: "আমাদের সম্পর্কে", en: "About Us", ar: "من نحن" },
        "History": { bn: "ইতিহাস", en: "History", ar: "التاريخ" },
        "Curriculum": { bn: "পাঠ্যক্রম", en: "Curriculum", ar: "المنهج" },
        "Trust Activities": { bn: "ট্রাস্ট কার্যক্রম", en: "Trust Activities", ar: "أنشطة الصندوق" },
        "Gallery": { bn: "গ্যালারি", en: "Gallery", ar: "معرض الصور" },
        "Donation": { bn: "দান", en: "Donation", ar: "التبرع" },
        "Donate Now": { bn: "এখনই দান করুন", en: "Donate Now", ar: "تبرع الآن" },
        "Contact": { bn: "যোগাযোগ", en: "Contact", ar: "اتصل بنا" },
        "Contact Us": { bn: "আমাদের সাথে যোগাযোগ", en: "Contact Us", ar: "اتصل بنا" },
        "Send Message": { bn: "বার্তা পাঠান", en: "Send Message", ar: "إرسال رسالة" },
        "Explore More": { bn: "আরও দেখুন", en: "Explore More", ar: "استكشف المزيد" },
        "Our Services": { bn: "আমাদের সেবাসমূহ", en: "Our Services", ar: "خدماتنا" },
        "Our Teachers": { bn: "আমাদের শিক্ষকবৃন্দ", en: "Our Teachers", ar: "معلمونا" },
        "Read More...": { bn: "আরও পড়ুন...", en: "Read More...", ar: "اقرأ المزيد..." },
        "Support": { bn: "সহায়তা", en: "Support", ar: "الدعم" },
        "Join Us Now": { bn: "এখনই যোগ দিন", en: "Join Us Now", ar: "انضم إلينا الآن" },
        "Terms & Condition": { bn: "শর্তাবলী", en: "Terms & Condition", ar: "الشروط والأحكام" },
        "DARUL AMAN": { bn: "দারুল আমান", en: "DARUL AMAN", ar: "دار الأمان" },
        "Our Address": { bn: "আমাদের ঠিকানা", en: "Our Address", ar: "عنواننا" },
        "Quick Links": { bn: "দ্রুত লিংক", en: "Quick Links", ar: "روابط سريعة" },
        "Class Time": { bn: "ক্লাসের সময়", en: "Class Time", ar: "وقت الحصة" },
        "Newsletter": { bn: "নিউজলেটার", en: "Newsletter", ar: "النشرة الإخبارية" }
    };

    /* Build reverse lookup so any of the 3 stored strings can be matched back to a key */
    function findKey(rawText) {
        var text = rawText.replace(/\s+/g, " ").trim();
        if (DICT[text]) return text;
        for (var key in DICT) {
            var e = DICT[key];
            if (text === e.bn || text === e.en || text === e.ar) return key;
        }
        return null;
    }

    function translatePage(lang) {
        var selectors = ".nav-link, .dropdown-item, .navbar-brand, .btn, h1, h2, h3, h4, h5, h6, .section-title, footer a, .site-toolbar-label";
        var nodes = document.querySelectorAll(selectors);
        nodes.forEach(function (node) {
            if (node.closest && node.closest("#site-toolbar")) return;
            if (!node.childNodes || node.children.length > 0) {
                // element has child elements (icons etc.) — walk direct text nodes only
                node.childNodes.forEach(function (child) {
                    if (child.nodeType === 3 && child.textContent.trim()) {
                        var key = findKey(child.textContent);
                        if (key) child.textContent = child.textContent.replace(child.textContent.trim(), DICT[key][lang]);
                    }
                });
                return;
            }
            var key2 = findKey(node.textContent);
            if (key2) node.textContent = DICT[key2][lang];
        });
    }

    function applyLang(lang) {
        localStorage.setItem("da-lang", lang);
        document.documentElement.setAttribute("lang", lang === "bn" ? "bn" : (lang === "ar" ? "ar" : "en"));
        document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
        translatePage(lang);
        updateToolbarState();
    }

    function applyTheme(theme) {
        localStorage.setItem("da-theme", theme);
        document.documentElement.setAttribute("data-theme", theme);
        updateToolbarState();
    }

    /* ---------- 3. FLOATING TOOLBAR (injected on every page) ---------- */
    function updateToolbarState() {
        var theme = localStorage.getItem("da-theme") || "light";
        var lang = localStorage.getItem("da-lang") || "bn";
        var themeBtn = document.getElementById("da-theme-toggle");
        if (themeBtn) {
            themeBtn.innerHTML = theme === "dark"
                ? '<i class="fa-solid fa-sun"></i>'
                : '<i class="fa-solid fa-moon"></i>';
            themeBtn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
        }
        document.querySelectorAll(".da-lang-btn").forEach(function (b) {
            b.classList.toggle("active", b.getAttribute("data-lang") === lang);
        });
    }

    function buildToolbar() {
        if (document.getElementById("site-toolbar")) return;
        var bar = document.createElement("div");
        bar.id = "site-toolbar";
        bar.innerHTML =
            '<button id="da-theme-toggle" type="button" title="Dark / Light"></button>' +
            '<div class="da-lang-group" role="group" aria-label="Language">' +
            '<button class="da-lang-btn" data-lang="bn" type="button">বাং</button>' +
            '<button class="da-lang-btn" data-lang="en" type="button">EN</button>' +
            '<button class="da-lang-btn" data-lang="ar" type="button">عر</button>' +
            "</div>";
        document.body.appendChild(bar);

        document.getElementById("da-theme-toggle").addEventListener("click", function () {
            var current = document.documentElement.getAttribute("data-theme") || "light";
            applyTheme(current === "dark" ? "light" : "dark");
        });
        bar.querySelectorAll(".da-lang-btn").forEach(function (b) {
            b.addEventListener("click", function () {
                applyLang(b.getAttribute("data-lang"));
            });
        });
        updateToolbarState();
    }

    document.addEventListener("DOMContentLoaded", function () {
        buildToolbar();
        if (savedLang !== "en") translatePage(savedLang);
    });
})();
