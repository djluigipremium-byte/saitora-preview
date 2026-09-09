(function () {
  "use strict";

  const storageKey = "saitora-language";
  const supportedLanguages = ["bg", "en", "de"];
  const languageButtons = Array.from(document.querySelectorAll("[data-demo-lang]"));
  const demoTabs = Array.from(document.querySelectorAll("[data-demo-tab]"));
  const signatureScrollLinks = Array.from(document.querySelectorAll("[data-signature-scroll]"));
  const nav = document.querySelector("[data-a8-nav]");
  const navLinks = Array.from(document.querySelectorAll("[data-a8-nav-link]"));
  const menuToggle = document.querySelector("[data-a8-menu-toggle]");
  const projectButtons = Array.from(document.querySelectorAll("[data-project-key]"));
  const projectVisual = document.querySelector("[data-project-visual]");
  const inquirySection = document.querySelector("[data-a8-inquiry-section]");
  const inquiryPanel = document.querySelector("[data-a8-inquiry-panel]");
  const inquiryForm = document.querySelector("[data-a8-inquiry-form]");
  const inquiryResult = document.querySelector("[data-a8-inquiry-result]");
  const openInquiryButtons = Array.from(document.querySelectorAll("[data-open-a8-inquiry]"));
  const closeInquiryButton = document.querySelector("[data-close-a8-inquiry]");
  const reviseInquiryButton = document.querySelector("[data-revise-a8-inquiry]");
  const fields = inquiryForm
    ? Array.from(inquiryForm.querySelectorAll("[data-a8-field]")).reduce((items, field) => {
        items[field.dataset.a8Field] = field;
        return items;
      }, {})
    : {};
  const errors = inquiryForm
    ? Array.from(inquiryForm.querySelectorAll("[data-a8-error]")).reduce((items, error) => {
        items[error.dataset.a8Error] = error;
        return items;
      }, {})
    : {};

  const translations = {
    bg: {
      meta: {
        title: "Saitora Signature Demo | Atelier No. 8",
        description:
          "Saitora Signature demo - премиум уебсайт преживяване с live client-site preview за Atelier No. 8."
      },
      product: {
        eyebrow: "Saitora Signature",
        title: "Премиум уебсайт преживяване",
        copy:
          "Цялостна концепция за клиентски сайт за бизнеси, при които доверие, позициониране и визуално качество имат значение.",
        actions: { preview: "Разгледайте live preview", included: "Какво е включено" },
        facts: {
          product: "Продукт",
          example: "Пример",
          format: "Формат",
          formatValue: "Live client-site preview"
        }
      },
      demoNav: {
        aria: "Навигация на demo формата",
        label: "Live client-site preview",
        overview: "Обзор",
        homepage: "Начало",
        projects: "Проекти",
        services: "Услуги",
        enquiry: "Запитване"
      },
      included: {
        kicker: "Какво е включено",
        title: "Saitora Signature показва бизнеса ясно, убедително и премиум.",
        items: {
          visual: {
            title: "Отличима визуална посока",
            copy: "Сайт, проектиран около реалния бизнес, не около повторен шаблон."
          },
          positioning: {
            title: "Ясно позициониране на услугите",
            copy: "Посетителите разбират офертата, стойността и следващата стъпка бързо."
          },
          credibility: {
            title: "Избрана работа и доверие",
            copy: "Проекти, казуси или доказателства са представени премиум и убедително."
          },
          enquiry: {
            title: "Структурирано запитване",
            copy: "Рафиниран contact flow събира правилната начална информация."
          }
        }
      },
      preview: {
        kicker: "Илюстративен клиентски сайт",
        copy:
          "Live preview за премиум интериорно студио: начало, проекти, услуги и структуриран inquiry flow.",
        label: "Illustrative client website",
        aria: "Илюстративен клиентски сайт на Atelier No. 8"
      },
      brand: { location: "Sofia / Europe" },
      nav: {
        aria: "Навигация на Atelier No. 8",
        menu: "Меню",
        home: "Начало",
        projects: "Проекти",
        services: "Услуги",
        enquiry: "Запитване"
      },
      actions: { startConversation: "Започнете разговор", exploreWork: "Вижте проекти" },
      hero: {
        eyebrow: "Интериорна архитектура и пространствена посока",
        title: "Интериори с премерено усещане за спокойствие.",
        copy:
          "Кратко, ясно позициониране за студио, което работи с частни домове, boutique hospitality и подбрани търговски пространства."
      },
      projects: {
        kicker: "Избрани проекти",
        title: "Проектите показват стил, доверие и обхват.",
        helper:
          "Изберете проект, за да видите как се променят визуалната композиция, историята и материалната посока.",
        selectorAria: "Избор на проект",
        items: {
          residence: {
            title: "Residence 07",
            type: "Частен дом",
            location: "София, България",
            year: "2026",
            story: "Спокоен градски дом с ниска мебелна линия, мека светлина и материали, които носят доверие.",
            materials: ["Опушен дъб", "Варовик", "Четкан метал"]
          },
          mori: {
            title: "Mori House",
            type: "Boutique hospitality",
            location: "Пловдив, България",
            year: "2025",
            story: "Малко място за престой с тиха рецепция, естествена мазилка, лен и топла вечерна светлина.",
            materials: ["Естествена мазилка", "Лен", "Топла светлина"]
          },
          noma: {
            title: "Noma Studio",
            type: "Творческо пространство",
            location: "София, България",
            year: "2025",
            story: "Работно пространство с дъбова мебелировка, акустични повърхности и прецизно съхранение.",
            materials: ["Дъбова мебелировка", "Акустични повърхности", "Прецизно съхранение"]
          }
        }
      },
      services: {
        kicker: "Услуги",
        title: "Ясни услуги, лесни за разбиране.",
        items: {
          residential: { title: "Жилищни интериори", copy: "Домове с ясна пространствена логика и спокойна атмосфера." },
          hospitality: { title: "Boutique hospitality", copy: "Малки места за престой с личен ритъм и силно усещане за място." },
          commercial: {
            title: "Търговски пространства",
            copy: "Студиа, шоуруми и работни среди, където функцията и имиджът работят заедно."
          },
          material: { title: "Материали и осветление", copy: "Посока за повърхности, светлина и атмосфера преди финалните решения." }
        }
      },
      inquiry: {
        featureLabel: "Структуриран inquiry flow",
        title: "Първото запитване вече има контекст.",
        copy: "Помага да се събере важният проектен контекст преди първия разговор.",
        fields: {
          name: "Име",
          email: "Имейл",
          projectType: "Тип проект",
          timeline: "Предпочитан срок",
          note: "Кратка бележка за проекта"
        },
        options: {
          placeholder: "Изберете тип проект",
          residence: "Частен дом",
          hospitality: "Hospitality пространство",
          commercial: "Търговско пространство",
          exploring: "Все още проучвам"
        },
        timeline: {
          placeholder: "Без конкретен срок",
          soon: "В следващите 3 месеца",
          six: "До 6 месеца",
          later: "Планирам предварително"
        },
        actions: {
          review: "Преглед на запитването",
          close: "Затвори",
          revise: "Редактирай",
          saitora: "Обсъдете Saitora Signature сайт"
        },
        result: {
          title: "Вашият проектен контур е готов за преглед.",
          copy: "Това е илюстративно демо. Не е изпратено съобщение."
        }
      },
      footer: {
        aria: "Footer навигация",
        description: "Интериорна архитектура и пространствена посока",
        demoNote: "Илюстративна концепция, създадена като Saitora Signature демо."
      },
      validation: {
        name: "Моля, въведете име.",
        email: "Моля, въведете валиден имейл.",
        projectType: "Моля, изберете тип проект.",
        note: "Моля, добавете кратка бележка за проекта."
      }
    },
    en: {
      meta: {
        title: "Saitora Signature Demo | Atelier No. 8",
        description:
          "Saitora Signature demo - a premium website experience with a live client-site preview for Atelier No. 8."
      },
      product: {
        eyebrow: "Saitora Signature",
        title: "Premium website experience",
        copy:
          "A complete client-facing website concept for businesses where trust, positioning, and visual quality matter.",
        actions: { preview: "Explore the live preview", included: "What is included" },
        facts: { product: "Product", example: "Example", format: "Format", formatValue: "Live client-site preview" }
      },
      demoNav: {
        aria: "Demo format navigation",
        label: "Live client-site preview",
        overview: "Overview",
        homepage: "Homepage",
        projects: "Projects",
        services: "Services",
        enquiry: "Enquiry"
      },
      included: {
        kicker: "What is included",
        title: "Saitora Signature presents the business clearly, convincingly, and with a premium finish.",
        items: {
          visual: {
            title: "Distinctive visual direction",
            copy: "A website designed around the actual business, not a reused template."
          },
          positioning: {
            title: "Clear service positioning",
            copy: "Visitors understand the offer, the value, and the next step quickly."
          },
          credibility: {
            title: "Selected work and credibility",
            copy: "Projects, case studies, or proof are presented in a premium and convincing way."
          },
          enquiry: {
            title: "Structured enquiry experience",
            copy: "A refined contact flow collects the right initial information."
          }
        }
      },
      preview: {
        kicker: "Illustrative client website",
        copy:
          "A live preview for a premium interior studio: homepage, projects, services, and structured enquiry flow.",
        label: "Illustrative client website",
        aria: "Atelier No. 8 illustrative client website"
      },
      brand: { location: "Sofia / Europe" },
      nav: {
        aria: "Atelier No. 8 navigation",
        menu: "Menu",
        home: "Home",
        projects: "Projects",
        services: "Services",
        enquiry: "Enquiry"
      },
      actions: { startConversation: "Start a conversation", exploreWork: "View projects" },
      hero: {
        eyebrow: "Interior architecture and spatial direction",
        title: "Interiors with a deliberate sense of calm.",
        copy:
          "A concise position for a studio working across private residences, boutique hospitality, and selected commercial spaces."
      },
      projects: {
        kicker: "Selected projects",
        title: "Projects show style, credibility, and range.",
        helper:
          "Select a project to see how the visual composition, story, and material direction adapt.",
        selectorAria: "Project selector",
        items: {
          residence: {
            title: "Residence 07",
            type: "Private residence",
            location: "Sofia, Bulgaria",
            year: "2026",
            story: "A calm city residence with a low furniture line, soft light, and materials that build trust.",
            materials: ["Smoked oak", "Limestone", "Brushed metal"]
          },
          mori: {
            title: "Mori House",
            type: "Boutique hospitality",
            location: "Plovdiv, Bulgaria",
            year: "2025",
            story: "A small hospitality space with a quiet reception, natural plaster, linen, and warm evening light.",
            materials: ["Natural plaster", "Linen", "Warm light"]
          },
          noma: {
            title: "Noma Studio",
            type: "Creative workspace",
            location: "Sofia, Bulgaria",
            year: "2025",
            story: "A workspace with oak joinery, acoustic surfaces, and precise storage.",
            materials: ["Oak joinery", "Acoustic surfaces", "Precise storage"]
          }
        }
      },
      services: {
        kicker: "Services",
        title: "Clear services, easy to understand.",
        items: {
          residential: { title: "Residential interiors", copy: "Homes with clear spatial logic and a calm atmosphere." },
          hospitality: { title: "Boutique hospitality", copy: "Small places to stay with a personal rhythm and strong sense of place." },
          commercial: {
            title: "Commercial spaces",
            copy: "Studios, showrooms, and work environments where function and image work together."
          },
          material: { title: "Material and lighting direction", copy: "Guidance for surfaces, light, and atmosphere before final decisions." }
        }
      },
      inquiry: {
        featureLabel: "Structured enquiry flow",
        title: "The first enquiry already has context.",
        copy: "Helps collect the important project context before the first conversation.",
        fields: {
          name: "Name",
          email: "E-mail",
          projectType: "Project type",
          timeline: "Preferred timeline",
          note: "Short project note"
        },
        options: {
          placeholder: "Select a project type",
          residence: "Private residence",
          hospitality: "Hospitality space",
          commercial: "Commercial space",
          exploring: "I am still exploring"
        },
        timeline: {
          placeholder: "No fixed timeline",
          soon: "Within the next 3 months",
          six: "Within 6 months",
          later: "Planning ahead"
        },
        actions: {
          review: "Review project outline",
          close: "Close",
          revise: "Revise",
          saitora: "Discuss a Saitora Signature website"
        },
        result: {
          title: "Your project outline is ready to review.",
          copy: "This is an illustrative demo. No message has been sent."
        }
      },
      footer: {
        aria: "Footer navigation",
        description: "Interior architecture and spatial direction",
        demoNote: "Illustrative concept created as a Saitora Signature demo."
      },
      validation: {
        name: "Please enter your name.",
        email: "Please enter a valid e-mail address.",
        projectType: "Please choose a project type.",
        note: "Please add a short project note."
      }
    },
    de: {
      meta: {
        title: "Saitora Signature Demo | Atelier No. 8",
        description:
          "Saitora Signature Demo - Premium-Website-Erlebnis mit Live-Client-Site-Preview für Atelier No. 8."
      },
      product: {
        eyebrow: "Saitora Signature",
        title: "Premium-Website-Erlebnis",
        copy:
          "Ein vollständiges kundenorientiertes Website-Konzept für Unternehmen, bei denen Vertrauen, Positionierung und visuelle Qualität zählen.",
        actions: { preview: "Live-Preview ansehen", included: "Was enthalten ist" },
        facts: { product: "Produkt", example: "Beispiel", format: "Format", formatValue: "Live Client-Site Preview" }
      },
      demoNav: {
        aria: "Demoformat-Navigation",
        label: "Live Client-Site Preview",
        overview: "Überblick",
        homepage: "Homepage",
        projects: "Projekte",
        services: "Leistungen",
        enquiry: "Anfrage"
      },
      included: {
        kicker: "Was enthalten ist",
        title: "Saitora Signature präsentiert das Unternehmen klar, überzeugend und hochwertig.",
        items: {
          visual: {
            title: "Eigenständige visuelle Richtung",
            copy: "Eine Website für das echte Unternehmen, nicht für eine wiederverwendete Vorlage."
          },
          positioning: {
            title: "Klare Leistungspositionierung",
            copy: "Besucher verstehen Angebot, Wert und nächsten Schritt schnell."
          },
          credibility: {
            title: "Ausgewählte Arbeit und Vertrauen",
            copy: "Projekte, Case Studies oder Nachweise werden hochwertig und überzeugend gezeigt."
          },
          enquiry: {
            title: "Strukturierte Anfrage",
            copy: "Ein verfeinerter Kontaktfluss sammelt die richtige Anfangsinformation."
          }
        }
      },
      preview: {
        kicker: "Illustrative Client-Website",
        copy:
          "Eine Live-Preview für ein Premium-Interior-Studio: Homepage, Projekte, Leistungen und strukturierter Anfragefluss.",
        label: "Illustrative Client-Website",
        aria: "Illustrative Client-Website von Atelier No. 8"
      },
      brand: { location: "Sofia / Europe" },
      nav: {
        aria: "Navigation von Atelier No. 8",
        menu: "Menü",
        home: "Start",
        projects: "Projekte",
        services: "Leistungen",
        enquiry: "Anfrage"
      },
      actions: { startConversation: "Gespräch beginnen", exploreWork: "Projekte ansehen" },
      hero: {
        eyebrow: "Innenarchitektur und räumliche Ausrichtung",
        title: "Interieurs mit bewusst ruhiger Wirkung.",
        copy:
          "Eine klare Positionierung für ein Studio für private Wohnräume, Boutique-Hospitality und ausgewählte gewerbliche Räume."
      },
      projects: {
        kicker: "Ausgewählte Projekte",
        title: "Projekte zeigen Stil, Vertrauen und Bandbreite.",
        helper:
          "Wählen Sie ein Projekt, um zu sehen, wie sich visuelle Komposition, Geschichte und Materialrichtung anpassen.",
        selectorAria: "Projektauswahl",
        items: {
          residence: {
            title: "Residence 07",
            type: "Private residence",
            location: "Sofia, Bulgarien",
            year: "2026",
            story: "Ein ruhiger Stadtwohnsitz mit niedriger Möbellinie, weichem Licht und vertrauensbildenden Materialien.",
            materials: ["Geräucherte Eiche", "Kalkstein", "Gebürstetes Metall"]
          },
          mori: {
            title: "Mori House",
            type: "Boutique hospitality",
            location: "Plovdiv, Bulgarien",
            year: "2025",
            story: "Ein kleiner Aufenthaltsort mit ruhiger Rezeption, natürlichem Putz, Leinen und warmem Abendlicht.",
            materials: ["Natürlicher Putz", "Leinen", "Warmes Licht"]
          },
          noma: {
            title: "Noma Studio",
            type: "Creative workspace",
            location: "Sofia, Bulgarien",
            year: "2025",
            story: "Ein Arbeitsraum mit Eicheneinbauten, akustischen Flächen und präzisem Stauraum.",
            materials: ["Eicheneinbauten", "Akustische Flächen", "Präziser Stauraum"]
          }
        }
      },
      services: {
        kicker: "Leistungen",
        title: "Klare Leistungen, leicht verständlich.",
        items: {
          residential: { title: "Wohninterieurs", copy: "Wohnräume mit klarer räumlicher Logik und ruhiger Atmosphäre." },
          hospitality: { title: "Boutique hospitality", copy: "Kleine Aufenthaltsorte mit persönlichem Rhythmus und starkem Ortsgefühl." },
          commercial: {
            title: "Gewerbliche Räume",
            copy: "Studios, Showrooms und Arbeitsräume, in denen Funktion und Erscheinung zusammenarbeiten."
          },
          material: { title: "Material- und Lichtführung", copy: "Richtung für Oberflächen, Licht und Atmosphäre vor finalen Entscheidungen." }
        }
      },
      inquiry: {
        featureLabel: "Strukturierter Anfragefluss",
        title: "Die erste Anfrage hat bereits Kontext.",
        copy: "Hilft, den wichtigen Projektkontext vor dem ersten Gespräch zu erfassen.",
        fields: {
          name: "Name",
          email: "E-Mail",
          projectType: "Projekttyp",
          timeline: "Gewünschter Zeitrahmen",
          note: "Kurze Projektnotiz"
        },
        options: {
          placeholder: "Projekttyp auswählen",
          residence: "Private residence",
          hospitality: "Hospitality space",
          commercial: "Commercial space",
          exploring: "Ich orientiere mich noch"
        },
        timeline: {
          placeholder: "Kein fester Zeitrahmen",
          soon: "In den nächsten 3 Monaten",
          six: "Innerhalb von 6 Monaten",
          later: "Ich plane voraus"
        },
        actions: {
          review: "Projektentwurf prüfen",
          close: "Schließen",
          revise: "Bearbeiten",
          saitora: "Saitora Signature Website besprechen"
        },
        result: {
          title: "Ihr Projektentwurf ist bereit zur Prüfung.",
          copy: "Dies ist ein illustratives Demo. Es wurde keine Nachricht gesendet."
        }
      },
      footer: {
        aria: "Footer-Navigation",
        description: "Innenarchitektur und räumliche Ausrichtung",
        demoNote: "Illustratives Konzept, erstellt als Saitora Signature Demo."
      },
      validation: {
        name: "Bitte geben Sie Ihren Namen ein.",
        email: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
        projectType: "Bitte wählen Sie einen Projekttyp.",
        note: "Bitte ergänzen Sie eine kurze Projektnotiz."
      }
    }
  };

  let currentLanguage = getInitialLanguage();
  let currentProject = "residence";
  let activeObserver = null;

  function getSearchLanguage() {
    try {
      const params = new URLSearchParams(window.location.search);
      const language = params.get("lang");
      return supportedLanguages.includes(language) ? language : "";
    } catch (error) {
      return "";
    }
  }

  function getInitialLanguage() {
    const urlLanguage = getSearchLanguage();
    if (urlLanguage) return urlLanguage;

    try {
      const saved = window.localStorage.getItem(storageKey);
      return supportedLanguages.includes(saved) ? saved : "bg";
    } catch (error) {
      return "bg";
    }
  }

  function storeLanguage(language) {
    try {
      window.localStorage.setItem(storageKey, language);
    } catch (error) {
      return;
    }
  }

  function getValue(path) {
    const segments = path.split(".");
    let value = translations[currentLanguage];

    for (const segment of segments) {
      if (value && Object.prototype.hasOwnProperty.call(value, segment)) {
        value = value[segment];
      } else {
        return undefined;
      }
    }

    return value;
  }

  function setMetaContent(selector, value) {
    const element = document.querySelector(selector);
    if (element && value) element.setAttribute("content", value);
  }

  function updateStaticTranslations() {
    document.documentElement.lang = currentLanguage;
    document.querySelectorAll("[data-a8-i18n]").forEach((element) => {
      const value = getValue(element.dataset.a8I18n);
      if (typeof value === "string") element.textContent = value;
    });

    document.querySelectorAll("[data-a8-i18n-aria-label]").forEach((element) => {
      const value = getValue(element.dataset.a8I18nAriaLabel);
      if (typeof value === "string") element.setAttribute("aria-label", value);
    });

    document.title = getValue("meta.title") || document.title;
    setMetaContent("meta[name='description']", getValue("meta.description"));
  }

  function updateSaitoraCtas() {
    document.querySelectorAll("[data-demo-cta]").forEach((link) => {
      link.setAttribute(
        "href",
        `../index.html?intake=1&solution=signature&lang=${encodeURIComponent(currentLanguage)}`
      );
    });
  }

  function getCurrentProject() {
    return translations[currentLanguage].projects.items[currentProject];
  }

  function renderProjectButtons() {
    projectButtons.forEach((button) => {
      const key = button.dataset.projectKey;
      const project = translations[currentLanguage].projects.items[key];
      const type = button.querySelector("[data-project-button-type]");
      const isActive = key === currentProject;

      if (type && project) type.textContent = project.type;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function renderProject() {
    const project = getCurrentProject();
    if (!project) return;

    const title = document.querySelector("[data-project-title]");
    const type = document.querySelector("[data-project-type]");
    const location = document.querySelector("[data-project-location]");
    const year = document.querySelector("[data-project-year]");
    const story = document.querySelector("[data-project-story]");
    const materialNotes = Array.from(document.querySelectorAll("[data-material-note]"));

    if (title) title.textContent = project.title;
    if (type) type.textContent = project.type;
    if (location) location.textContent = project.location;
    if (year) year.textContent = project.year;
    if (story) story.textContent = project.story;

    materialNotes.forEach((item, index) => {
      item.textContent = project.materials[index] || "";
      item.hidden = !project.materials[index];
    });

    if (projectVisual) {
      projectVisual.classList.remove("project-residence", "project-mori", "project-noma");
      projectVisual.classList.add(`project-${currentProject}`);
    }

    renderProjectButtons();
  }

  function setActiveDemoTab(targetSelector) {
    demoTabs.forEach((button) => {
      const isActive = button.dataset.demoTab === targetSelector;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function updateClientNav(id) {
    navLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function applyLanguage(language) {
    if (!supportedLanguages.includes(language)) return;
    currentLanguage = language;
    storeLanguage(language);
    updateStaticTranslations();
    renderProject();
    updateSaitoraCtas();
  }

  function closeMenu() {
    if (!nav || !menuToggle) return;
    nav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
  }

  function toggleMenu() {
    if (!nav || !menuToggle) return;
    const isOpen = nav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  }

  function focusTarget(target) {
    if (!target) return;
    const previousTabIndex = target.getAttribute("tabindex");
    if (previousTabIndex === null) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    if (previousTabIndex === null) {
      target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
    }
  }

  function scrollToTarget(selector, focusAfterScroll = true) {
    const target = document.querySelector(selector);
    if (!target) return;

    closeMenu();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    if (focusAfterScroll) {
      window.setTimeout(() => focusTarget(target), 420);
    }
  }

  function handleAnchorClick(event) {
    const href = event.currentTarget.getAttribute("href");
    if (!href || !href.startsWith("#") || !document.querySelector(href)) return;

    event.preventDefault();
    scrollToTarget(href);
  }

  function selectProject(key, focusButton = false) {
    if (!translations[currentLanguage].projects.items[key]) return;
    currentProject = key;
    renderProject();

    if (focusButton) {
      const button = projectButtons.find((item) => item.dataset.projectKey === key);
      if (button) button.focus();
    }
  }

  function setFieldError(key, message = "") {
    const field = fields[key];
    const error = errors[key];
    if (!field || !error) return;

    error.textContent = message;
    if (message) {
      field.setAttribute("aria-invalid", "true");
    } else {
      field.removeAttribute("aria-invalid");
    }
  }

  function clearErrors() {
    Object.keys(errors).forEach((key) => setFieldError(key));
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validateInquiry() {
    let valid = true;
    clearErrors();

    if (!fields.name.value.trim()) {
      setFieldError("name", getValue("validation.name"));
      valid = false;
    }

    if (!isValidEmail(fields.email.value.trim())) {
      setFieldError("email", getValue("validation.email"));
      valid = false;
    }

    if (!fields.projectType.value) {
      setFieldError("projectType", getValue("validation.projectType"));
      valid = false;
    }

    if (!fields.note.value.trim()) {
      setFieldError("note", getValue("validation.note"));
      valid = false;
    }

    return valid;
  }

  function openInquiry(focusFirstField = true) {
    if (!inquiryPanel || !inquirySection) return;
    inquiryPanel.hidden = false;
    inquiryPanel.classList.add("is-open");
    scrollToTarget("#preview-inquiry", false);

    if (focusFirstField && fields.name && !inquiryForm.hidden) {
      window.setTimeout(() => fields.name.focus(), 460);
    }
  }

  function closeInquiry() {
    if (!inquiryPanel) return;
    inquiryPanel.classList.remove("is-open");
    inquiryPanel.hidden = true;
    if (inquiryForm) inquiryForm.hidden = false;
    if (inquiryResult) inquiryResult.hidden = true;
  }

  function showInquiryResult() {
    if (!inquiryForm || !inquiryResult) return;
    inquiryForm.hidden = true;
    inquiryResult.hidden = false;
    focusTarget(inquiryResult);
  }

  function initActiveSections() {
    const observed = Array.from(document.querySelectorAll("[data-signature-section]"));
    if (!observed.length || !("IntersectionObserver" in window)) return;
    if (activeObserver) activeObserver.disconnect();

    const tabMap = {
      "demo-overview": "#demo-overview",
      "preview-home": "#preview-home",
      "preview-projects": "#preview-projects",
      "preview-services": "#preview-services",
      "preview-inquiry": "#preview-inquiry"
    };

    activeObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;
        const id = visible.target.id;
        if (tabMap[id]) setActiveDemoTab(tabMap[id]);
        updateClientNav(id);
      },
      { threshold: [0.22, 0.42, 0.6], rootMargin: "-18% 0px -56% 0px" }
    );

    observed.forEach((section) => activeObserver.observe(section));
  }

  signatureScrollLinks.forEach((link) => {
    link.addEventListener("click", handleAnchorClick);
  });

  document.querySelectorAll("[data-a8-scroll]").forEach((link) => {
    link.addEventListener("click", handleAnchorClick);
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", handleAnchorClick);
  });

  demoTabs.forEach((button, index) => {
    button.addEventListener("click", () => {
      setActiveDemoTab(button.dataset.demoTab);
      scrollToTarget(button.dataset.demoTab);
    });

    button.addEventListener("keydown", (event) => {
      const keyActions = {
        ArrowRight: () => (index + 1) % demoTabs.length,
        ArrowDown: () => (index + 1) % demoTabs.length,
        ArrowLeft: () => (index - 1 + demoTabs.length) % demoTabs.length,
        ArrowUp: () => (index - 1 + demoTabs.length) % demoTabs.length,
        Home: () => 0,
        End: () => demoTabs.length - 1
      };

      if (!keyActions[event.key]) return;
      event.preventDefault();
      const nextButton = demoTabs[keyActions[event.key]()];
      nextButton.focus();
      setActiveDemoTab(nextButton.dataset.demoTab);
    });
  });

  if (menuToggle) {
    menuToggle.addEventListener("click", toggleMenu);
  }

  projectButtons.forEach((button, index) => {
    button.addEventListener("click", () => selectProject(button.dataset.projectKey));
    button.addEventListener("keydown", (event) => {
      const keyActions = {
        ArrowDown: () => (index + 1) % projectButtons.length,
        ArrowRight: () => (index + 1) % projectButtons.length,
        ArrowUp: () => (index - 1 + projectButtons.length) % projectButtons.length,
        ArrowLeft: () => (index - 1 + projectButtons.length) % projectButtons.length,
        Home: () => 0,
        End: () => projectButtons.length - 1
      };

      if (!keyActions[event.key]) return;
      event.preventDefault();
      const nextButton = projectButtons[keyActions[event.key]()];
      selectProject(nextButton.dataset.projectKey, true);
    });
  });

  languageButtons.forEach((button) => {
    button.addEventListener("click", () => applyLanguage(button.dataset.demoLang));
  });

  openInquiryButtons.forEach((button) => {
    button.addEventListener("click", () => openInquiry(true));
  });

  if (closeInquiryButton) {
    closeInquiryButton.addEventListener("click", closeInquiry);
  }

  if (reviseInquiryButton) {
    reviseInquiryButton.addEventListener("click", () => {
      if (inquiryForm) inquiryForm.hidden = false;
      if (inquiryResult) inquiryResult.hidden = true;
      if (fields.name) fields.name.focus();
    });
  }

  if (inquiryForm) {
    inquiryForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (validateInquiry()) showInquiryResult();
    });

    Object.keys(fields).forEach((key) => {
      const eventName = fields[key].tagName === "SELECT" ? "change" : "input";
      fields[key].addEventListener(eventName, () => setFieldError(key));
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  if (inquiryResult) inquiryResult.setAttribute("tabindex", "-1");

  applyLanguage(currentLanguage);
  initActiveSections();
})();
