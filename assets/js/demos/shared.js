(function () {
  "use strict";

  const storageKey = "saitora-language";
  const supportedLanguages = ["bg", "en", "de"];
  const body = document.body;
  const demoKey = body.dataset.demoKey;
  const intakeSolution = body.dataset.intakeSolution || demoKey;
  const languageButtons = Array.from(document.querySelectorAll("[data-demo-lang]"));
  const demoCtaLinks = Array.from(document.querySelectorAll("[data-demo-cta]"));
  const mainLinks = Array.from(document.querySelectorAll("[data-main-link]"));
  const solutionsLinks = Array.from(document.querySelectorAll("[data-solutions-link]"));

  const translations = {
    bg: {
      common: {
        brandHome: "SAITORA начало",
        demoLabel: "Илюстративно интерактивно демо",
        navAria: "Демо навигация",
        languageAria: "Език",
        back: "Назад към решенията",
        discuss: "Обсъди това решение",
        openMain: "Към основния сайт",
        foundationLabel: "Структура",
        foundationTitle: "Основни зони за следващия дизайн",
        contractLabel: "Дизайн договор",
        contractTitle: "Посока за бъдещото пълно демо"
      },
      pages: {
        signature: {
          title: "Saitora Signature Demo | Atelier No. 8",
          meta:
            "Илюстративна демо основа за Saitora Signature - премиум бизнес уебсайт за Atelier No. 8.",
          product: "Saitora Signature",
          brand: "Atelier No. 8",
          purpose: "Премиум бизнес уебсайт",
          intro:
            "Основата за бъдещо луксозно редакционно демо, в което Saitora Signature показва как премиум услуга може да разказва история, да представя проекти и да води към качествени запитвания.",
          brief:
            "Тази страница задава маршрута, езиковата логика и структурата. Детайлният сайт, проектните модули и преживяването за запитвания ще бъдат изградени отделно.",
          zones: [
            {
              label: "История",
              title: "Редакционен първи изглед",
              copy: "Зона за бъдеща начална секция с атмосфера, позициониране и премиум типография."
            },
            {
              label: "Проекти",
              title: "Подбрани проекти",
              copy: "Структурна зона за бъдещи казуси, услуги и визуално водене към доверие."
            },
            {
              label: "Запитвания",
              title: "Път към запитване",
              copy: "Място за бъдещ ясен път към контакт, без да се изгражда формата в тази задача."
            }
          ],
          direction: [
            "Луксозен редакционен уебсайт, не SaaS табло.",
            "Топъл ivory, graphite и деликатен copper ритъм.",
            "Разказване, услуги, проекти и запитвания като основни бъдещи модули."
          ]
        },
        capture: {
          title: "Saitora Capture Demo | ProClean Sofia",
          meta:
            "Илюстративна демо основа за Saitora Capture - заявки и CRM структура за ProClean Sofia.",
          product: "Saitora Capture",
          brand: "ProClean Sofia",
          purpose: "Запитвания и CRM",
          intro:
            "Основата за бъдещо оперативно CRM демо, което ще покаже как входящите заявки, клиентите и последващите действия могат да влязат в подреден процес.",
          brief:
            "Тази страница създава основната рамка, маршрута и структурните зони. Реалната логика на процеса и детайлните интерактивни състояния ще бъдат проектирани отделно.",
          zones: [
            {
              label: "Заявки",
              title: "Процес за заявки",
              copy: "Зона за бъдещи входящи заявки, статуси и приоритети без финална CRM таблица сега."
            },
            {
              label: "Клиенти",
              title: "Клиентски контекст",
              copy: "Място за профили, история на комуникацията и качествено последващо действие."
            },
            {
              label: "Активност",
              title: "Ритъм на екипа",
              copy: "Зона за бъдещи задачи, напомняния и активност, изградена с оперативна яснота."
            }
          ],
          direction: [
            "Уверен оперативен CRM с чист процес за заявки.",
            "Лийдове, клиенти, последващи действия и активност без generic SaaS усещане.",
            "Елегантен интерфейс за екипна работа и проследяване."
          ]
        },
        booking: {
          title: "Saitora Booking OS Demo | Luma Event Hall",
          meta:
            "Илюстративна демо основа за Saitora Booking OS - резервации, календар и плащания за Luma Event Hall.",
          product: "Saitora Booking OS",
          brand: "Luma Event Hall",
          purpose: "Резервации, календар и плащания",
          intro:
            "Основата за бъдещ център за управление на резервации, където събития, наличности, капара и приходи ще се подредят в ясна логика за event бизнес.",
          brief:
            "Маршрутът и структурните зони са готови. Подробният календар, статусите и прегледът на плащанията ще бъдат изградени в отделен дизайн етап.",
          zones: [
            {
              label: "Календар",
              title: "Логика за наличности",
              copy: "Зона за бъдещо управление на свободни и заети дати без финален календар сега."
            },
            {
              label: "Резервации",
              title: "Статус на резервации",
              copy: "Място за бъдещи заявки, потвърждения, капара и комуникационни състояния."
            },
            {
              label: "Приходи",
              title: "Преглед на капара",
              copy: "Структурна зона за бъдеща финансова яснота, без да се добавя payment функционалност."
            }
          ],
          direction: [
            "Премиум център за управление на резервации за събития и пространства.",
            "Календар, статуси, капара, наличности и приходи.",
            "Ясна логика за график и резервации без претоварване."
          ]
        },
        command: {
          title: "Saitora Command Demo | NordBuild Operations",
          meta:
            "Илюстративна демо основа за Saitora Command - вътрешна оперативна система за NordBuild Operations.",
          product: "Saitora Command",
          brand: "NordBuild Operations",
          purpose: "Вътрешна оперативна система",
          intro:
            "Основата за бъдещ дисциплиниран оперативен център, който ще подрежда задачи, екипи, обекти, одобрения и активност с професионална яснота.",
          brief:
            "Тук са създадени маршрутът, основната рамка и бъдещите зони. Детайлните оперативни изгледи и действия по задачи не се изграждат в тази задача.",
          zones: [
            {
              label: "Обекти",
              title: "Обекти и приоритети",
              copy: "Зона за бъдещи активни обекти, приоритети и оперативни индикатори."
            },
            {
              label: "Екипи",
              title: "Натоварване на екипа",
              copy: "Място за бъдещи екипи, отговорности и натоварване без шумна имитация на project-management инструмент."
            },
            {
              label: "Одобрения",
              title: "Одобрения и активност",
              copy: "Зона за бъдещи решения, документи и операционна история."
            }
          ],
          direction: [
            "Дисциплиниран оперативен център за управление.",
            "Задачи, екипи, обекти, приоритети, одобрения и активност.",
            "Професионална корпоративна яснота, не project-management clone."
          ]
        },
        portal: {
          title: "Saitora Portal Demo | Forma Studio Portal",
          meta:
            "Илюстративна демо основа за Saitora Portal - клиентски портал за Forma Studio Portal.",
          product: "Saitora Portal",
          brand: "Forma Studio Portal",
          purpose: "Клиентски портал",
          intro:
            "Основата за бъдещо спокойно клиентско работно пространство, в което статус, файлове, фактури, времева линия и срещи дават яснота на клиента.",
          brief:
            "Създадена е само архитектурата за страницата. Финалното portal преживяване, водено от нуждите на клиента, ще бъде разработено отделно.",
          zones: [
            {
              label: "Проект",
              title: "Статус за клиента",
              copy: "Зона за бъдещ проектен статус, ключови етапи и ясна клиентска ориентация."
            },
            {
              label: "Файлове",
              title: "Документи и фактури",
              copy: "Място за бъдещи файлове, оферти, фактури и обмен без фалшив вход."
            },
            {
              label: "Актуализации",
              title: "Времева линия и срещи",
              copy: "Зона за бъдещи срещи, времева линия и подредена комуникация."
            }
          ],
          direction: [
            "Спокойно, елегантно клиентско работно пространство.",
            "Проектен статус, файлове, фактури, времева линия, срещи и актуализации.",
            "Клиентско преживяване, не admin-first интерфейс."
          ]
        },
        automate: {
          title: "Saitora Automate Demo | Aurelia Auto Care",
          meta:
            "Илюстративна демо основа за Saitora Automate - бизнес автоматизации за Aurelia Auto Care.",
          product: "Saitora Automate",
          brand: "Aurelia Auto Care",
          purpose: "Бизнес автоматизации",
          intro:
            "Основата за бъдещо работно пространство за автоматизации, което ще визуализира начални събития, действия, комуникация, напомняния и отчетни потоци.",
          brief:
            "Маршрутът, основната рамка и зоните са готови. Детайлната workflow дъска и интерактивният модел ще бъдат изградени в отделна задача.",
          zones: [
            {
              label: "Сигнал",
              title: "Начало и условие",
              copy: "Зона за бъдещо начало на автоматизиран процес без generic low-code дъска."
            },
            {
              label: "Действие",
              title: "Комуникация и задачи",
              copy: "Място за бъдещи автоматични отговори, задачи и напомняния."
            },
            {
              label: "Отчет",
              title: "Оперативна обратна връзка",
              copy: "Зона за бъдещо отчитане, седмични summaries и контрол."
            }
          ],
          direction: [
            "Изчистено работно пространство за автоматизации.",
            "Сигнали, действия, комуникация, напомняния и отчетни потоци.",
            "Ясна workflow визуализация, не generic low-code clone."
          ]
        }
      }
    },
    en: {
      common: {
        brandHome: "SAITORA home",
        demoLabel: "Illustrative interactive demo",
        navAria: "Demo navigation",
        languageAria: "Language",
        back: "Back to solutions",
        discuss: "Discuss this solution",
        openMain: "Main site",
        foundationLabel: "Structure",
        foundationTitle: "Core zones for the next design stage",
        contractLabel: "Design contract",
        contractTitle: "Direction for the future full demo"
      },
      pages: {
        signature: {
          title: "Saitora Signature Demo | Atelier No. 8",
          meta:
            "Illustrative demo foundation for Saitora Signature - a premium business website for Atelier No. 8.",
          product: "Saitora Signature",
          brand: "Atelier No. 8",
          purpose: "Premium business website",
          intro:
            "A foundation for a future editorial luxury demo showing how Saitora Signature can tell a premium service story, present projects, and lead to qualified enquiries.",
          brief:
            "This page sets the route, language logic, and structure. The detailed website, project modules, and enquiry experience will be built separately.",
          zones: [
            {
              label: "Story",
              title: "Editorial first view",
              copy: "A future opening section for atmosphere, positioning, and premium typography."
            },
            {
              label: "Projects",
              title: "Selected work",
              copy: "A structural zone for future cases, services, and trust-building visual rhythm."
            },
            {
              label: "Enquiries",
              title: "Enquiry path",
              copy: "A place for a future clear contact path, without building the form in this task."
            }
          ],
          direction: [
            "Editorial luxury website, not a SaaS dashboard.",
            "Warm ivory, graphite, and a subtle copper rhythm.",
            "Storytelling, services, projects, and enquiries as the future core modules."
          ]
        },
        capture: {
          title: "Saitora Capture Demo | ProClean Sofia",
          meta:
            "Illustrative demo foundation for Saitora Capture - enquiries and CRM structure for ProClean Sofia.",
          product: "Saitora Capture",
          brand: "ProClean Sofia",
          purpose: "Enquiries and CRM",
          intro:
            "A foundation for a future operational CRM demo showing how enquiries, clients, and follow-up actions can move through an organised process.",
          brief:
            "This page creates the shell, route, and structural zones. The real pipeline logic and detailed interaction states will be designed separately.",
          zones: [
            {
              label: "Requests",
              title: "Request pipeline",
              copy: "A future zone for incoming requests, statuses, and priorities without a final CRM table now."
            },
            {
              label: "Clients",
              title: "Client context",
              copy: "A place for profiles, communication history, and thoughtful follow-up."
            },
            {
              label: "Activity",
              title: "Team rhythm",
              copy: "A future zone for tasks, reminders, and activity with operational clarity."
            }
          ],
          direction: [
            "Confident operational CRM with a clean request pipeline.",
            "Leads, clients, follow-ups, and activity without a generic SaaS feel.",
            "An elegant team interface for tracking and response."
          ]
        },
        booking: {
          title: "Saitora Booking OS Demo | Luma Event Hall",
          meta:
            "Illustrative demo foundation for Saitora Booking OS - reservations, calendar, and payments for Luma Event Hall.",
          product: "Saitora Booking OS",
          brand: "Luma Event Hall",
          purpose: "Reservations, calendar, and payments",
          intro:
            "A foundation for a future booking control centre where events, availability, deposits, and revenue are organised with clear hospitality logic.",
          brief:
            "The route and structural zones are ready. The detailed calendar, statuses, and payment overview will be built in a separate design stage.",
          zones: [
            {
              label: "Calendar",
              title: "Availability logic",
              copy: "A future zone for free and occupied dates without building the final calendar now."
            },
            {
              label: "Bookings",
              title: "Booking status",
              copy: "A place for future requests, confirmations, deposits, and communication states."
            },
            {
              label: "Revenue",
              title: "Deposit overview",
              copy: "A structural zone for future financial clarity, without adding payment functionality."
            }
          ],
          direction: [
            "Premium booking control centre for hospitality and events.",
            "Calendar, booking status, deposits, availability, and revenue.",
            "Clear scheduling logic without visual overload."
          ]
        },
        command: {
          title: "Saitora Command Demo | NordBuild Operations",
          meta:
            "Illustrative demo foundation for Saitora Command - an internal operations system for NordBuild Operations.",
          product: "Saitora Command",
          brand: "NordBuild Operations",
          purpose: "Internal operations system",
          intro:
            "A foundation for a future disciplined command centre organising tasks, teams, sites, approvals, and activity with enterprise clarity.",
          brief:
            "This page creates the route, shell, and future zones. Detailed operations views and task interactions are not built in this task.",
          zones: [
            {
              label: "Sites",
              title: "Sites and priorities",
              copy: "A future zone for active sites, priorities, and operational indicators."
            },
            {
              label: "Teams",
              title: "Team workload",
              copy: "A place for future teams, responsibilities, and workload without a noisy PM clone."
            },
            {
              label: "Approvals",
              title: "Approvals and activity",
              copy: "A future zone for decisions, documents, and operational history."
            }
          ],
          direction: [
            "Disciplined operational command centre.",
            "Tasks, teams, sites, priorities, approvals, and activity.",
            "Professional enterprise clarity, not a project-management clone."
          ]
        },
        portal: {
          title: "Saitora Portal Demo | Forma Studio Portal",
          meta:
            "Illustrative demo foundation for Saitora Portal - a client portal for Forma Studio Portal.",
          product: "Saitora Portal",
          brand: "Forma Studio Portal",
          purpose: "Client portal",
          intro:
            "A foundation for a calm client workspace demo where status, files, invoices, timeline, and meetings give the client clarity.",
          brief:
            "Only the page architecture is created here. The final client-first portal experience will be developed separately.",
          zones: [
            {
              label: "Project",
              title: "Client status",
              copy: "A future zone for project status, milestones, and clear client orientation."
            },
            {
              label: "Files",
              title: "Documents and invoices",
              copy: "A place for future files, offers, invoices, and exchange without a fake login."
            },
            {
              label: "Updates",
              title: "Timeline and meetings",
              copy: "A future zone for meetings, timeline, and organised communication."
            }
          ],
          direction: [
            "Calm, elegant client workspace feel.",
            "Project status, files, invoices, timeline, meetings, and updates.",
            "Client-first experience, not an admin-first interface."
          ]
        },
        automate: {
          title: "Saitora Automate Demo | Aurelia Auto Care",
          meta:
            "Illustrative demo foundation for Saitora Automate - business automations for Aurelia Auto Care.",
          product: "Saitora Automate",
          brand: "Aurelia Auto Care",
          purpose: "Business automations",
          intro:
            "A foundation for a future automation workspace demo visualising triggers, actions, communication, reminders, and reporting flows.",
          brief:
            "The route, shell, and zones are ready. The detailed workflow canvas and interaction model will be built in a separate task.",
          zones: [
            {
              label: "Trigger",
              title: "Signal and condition",
              copy: "A future zone for the start of an automation flow without a generic low-code canvas."
            },
            {
              label: "Action",
              title: "Communication and tasks",
              copy: "A place for future automatic replies, tasks, and reminders."
            },
            {
              label: "Report",
              title: "Operational feedback",
              copy: "A future zone for reporting, weekly summaries, and control."
            }
          ],
          direction: [
            "Sophisticated automation workspace.",
            "Trigger, action, communication, reminder, and reporting flows.",
            "Clear workflow visualisation, not a generic low-code clone."
          ]
        }
      }
    },
    de: {
      common: {
        brandHome: "SAITORA Startseite",
        demoLabel: "Illustratives interaktives Demo",
        navAria: "Demo-Navigation",
        languageAria: "Sprache",
        back: "Zurück zu den Lösungen",
        discuss: "Diese Lösung besprechen",
        openMain: "Hauptseite",
        foundationLabel: "Struktur",
        foundationTitle: "Kernzonen für die nächste Designphase",
        contractLabel: "Designrichtung",
        contractTitle: "Richtung für das spätere vollständige Demo"
      },
      pages: {
        signature: {
          title: "Saitora Signature Demo | Atelier No. 8",
          meta:
            "Illustrative Demo-Grundlage für Saitora Signature - eine Premium-Unternehmenswebsite für Atelier No. 8.",
          product: "Saitora Signature",
          brand: "Atelier No. 8",
          purpose: "Premium-Unternehmenswebsite",
          intro:
            "Eine Grundlage für ein zukünftiges Editorial-Luxury-Demo, das zeigt, wie Saitora Signature die Geschichte einer Premium-Leistung erzählt, Projekte präsentiert und zu qualifizierten Anfragen führt.",
          brief:
            "Diese Seite setzt Route, Sprachlogik und Struktur. Die detaillierte Website, Projektmodule und Anfrageführung werden separat aufgebaut.",
          zones: [
            {
              label: "Story",
              title: "Editorial first view",
              copy: "Eine zukünftige Einstiegssektion für Atmosphäre, Positionierung und hochwertige Typografie."
            },
            {
              label: "Projekte",
              title: "Selected work",
              copy: "Eine strukturelle Zone für spätere Projekte, Leistungen und vertrauensbildenden visuellen Rhythmus."
            },
            {
              label: "Anfragen",
              title: "Enquiry path",
              copy: "Ein Bereich für einen späteren klaren Kontaktweg, ohne in dieser Aufgabe ein Formular zu bauen."
            }
          ],
          direction: [
            "Editorial Luxury Website, kein SaaS-Dashboard.",
            "Warmes Ivory, Graphite und ein feiner Copper-Rhythmus.",
            "Storytelling, Leistungen, Projekte und Anfragen als spätere Kernmodule."
          ]
        },
        capture: {
          title: "Saitora Capture Demo | ProClean Sofia",
          meta:
            "Illustrative Demo-Grundlage für Saitora Capture - Anfrage- und CRM-Struktur für ProClean Sofia.",
          product: "Saitora Capture",
          brand: "ProClean Sofia",
          purpose: "Anfragen und CRM",
          intro:
            "Eine Grundlage für ein zukünftiges Operational-CRM-Demo, das zeigt, wie Anfragen, Kunden und Follow-ups in einen geordneten Prozess fließen.",
          brief:
            "Diese Seite erstellt Shell, Route und Strukturzonen. Die echte Pipeline-Logik und detaillierte Interaction States werden separat gestaltet.",
          zones: [
            {
              label: "Anfragen",
              title: "Request pipeline",
              copy: "Eine spätere Zone für eingehende Anfragen, Status und Prioritäten ohne finale CRM-Tabelle jetzt."
            },
            {
              label: "Kunden",
              title: "Client context",
              copy: "Ein Bereich für Profile, Kommunikationshistorie und durchdachtes Follow-up."
            },
            {
              label: "Aktivität",
              title: "Team rhythm",
              copy: "Eine spätere Zone für Aufgaben, Erinnerungen und Aktivität mit operativer Klarheit."
            }
          ],
          direction: [
            "Selbstbewusstes Operational CRM mit sauberer Anfrage-Pipeline.",
            "Leads, Kunden, Follow-ups und Aktivität ohne generischen SaaS-Eindruck.",
            "Ein elegantes Team-Interface für Nachverfolgung und Reaktion."
          ]
        },
        booking: {
          title: "Saitora Booking OS Demo | Luma Event Hall",
          meta:
            "Illustrative Demo-Grundlage für Saitora Booking OS - Reservierungen, Kalender und Zahlungen für Luma Event Hall.",
          product: "Saitora Booking OS",
          brand: "Luma Event Hall",
          purpose: "Reservierungen, Kalender und Zahlungen",
          intro:
            "Eine Grundlage für ein zukünftiges Booking Control Centre, in dem Events, Verfügbarkeit, Anzahlungen und Umsatz mit klarer Hospitality-Logik organisiert werden.",
          brief:
            "Route und Strukturzonen sind bereit. Der detaillierte Kalender, Status und Payment Overview werden in einer separaten Designphase gebaut.",
          zones: [
            {
              label: "Kalender",
              title: "Availability logic",
              copy: "Eine spätere Zone für freie und belegte Termine, ohne jetzt den finalen Kalender zu bauen."
            },
            {
              label: "Buchungen",
              title: "Booking status",
              copy: "Ein Bereich für spätere Anfragen, Bestätigungen, Anzahlungen und Kommunikationsstatus."
            },
            {
              label: "Umsatz",
              title: "Deposit overview",
              copy: "Eine strukturelle Zone für spätere finanzielle Klarheit, ohne Payment-Funktionalität hinzuzufügen."
            }
          ],
          direction: [
            "Premium Booking Control Centre für Hospitality und Events.",
            "Kalender, Buchungsstatus, Anzahlungen, Verfügbarkeit und Umsatz.",
            "Klare Scheduling-Logik ohne visuelle Überladung."
          ]
        },
        command: {
          title: "Saitora Command Demo | NordBuild Operations",
          meta:
            "Illustrative Demo-Grundlage für Saitora Command - ein internes Operations-System für NordBuild Operations.",
          product: "Saitora Command",
          brand: "NordBuild Operations",
          purpose: "Internes Operations-System",
          intro:
            "Eine Grundlage für ein zukünftiges diszipliniertes Command Centre, das Aufgaben, Teams, Standorte, Freigaben und Aktivität mit Enterprise-Klarheit organisiert.",
          brief:
            "Diese Seite erstellt Route, Shell und zukünftige Zonen. Detaillierte Operations Views und Task Interactions werden in dieser Aufgabe nicht gebaut.",
          zones: [
            {
              label: "Standorte",
              title: "Sites and priorities",
              copy: "Eine spätere Zone für aktive Standorte, Prioritäten und operative Indikatoren."
            },
            {
              label: "Teams",
              title: "Team workload",
              copy: "Ein Bereich für spätere Teams, Verantwortlichkeiten und Auslastung ohne lauten PM-Klon."
            },
            {
              label: "Freigaben",
              title: "Approvals and activity",
              copy: "Eine spätere Zone für Entscheidungen, Dokumente und operative Historie."
            }
          ],
          direction: [
            "Diszipliniertes Operational Command Centre.",
            "Aufgaben, Teams, Standorte, Prioritäten, Freigaben und Aktivität.",
            "Professionelle Enterprise-Klarheit, kein Projektmanagement-Klon."
          ]
        },
        portal: {
          title: "Saitora Portal Demo | Forma Studio Portal",
          meta:
            "Illustrative Demo-Grundlage für Saitora Portal - ein Kundenportal für Forma Studio Portal.",
          product: "Saitora Portal",
          brand: "Forma Studio Portal",
          purpose: "Kundenportal",
          intro:
            "Eine Grundlage für ein ruhiges Client-Workspace-Demo, in dem Status, Dateien, Rechnungen, Timeline und Termine dem Kunden Klarheit geben.",
          brief:
            "Hier wird nur die Seitenarchitektur erstellt. Das finale client-first Portal-Erlebnis wird separat entwickelt.",
          zones: [
            {
              label: "Projekt",
              title: "Client status",
              copy: "Eine spätere Zone für Projektstatus, Milestones und klare Kundenorientierung."
            },
            {
              label: "Dateien",
              title: "Documents and invoices",
              copy: "Ein Bereich für spätere Dateien, Angebote, Rechnungen und Austausch ohne Fake-Login."
            },
            {
              label: "Updates",
              title: "Timeline and meetings",
              copy: "Eine spätere Zone für Termine, Timeline und geordnete Kommunikation."
            }
          ],
          direction: [
            "Ruhiges, elegantes Client-Workspace-Gefühl.",
            "Projektstatus, Dateien, Rechnungen, Timeline, Termine und Updates.",
            "Client-first Erlebnis, kein admin-first Interface."
          ]
        },
        automate: {
          title: "Saitora Automate Demo | Aurelia Auto Care",
          meta:
            "Illustrative Demo-Grundlage für Saitora Automate - Business-Automatisierungen für Aurelia Auto Care.",
          product: "Saitora Automate",
          brand: "Aurelia Auto Care",
          purpose: "Business-Automatisierungen",
          intro:
            "Eine Grundlage für ein zukünftiges Automation-Workspace-Demo, das Trigger, Actions, Kommunikation, Erinnerungen und Reporting-Flows visualisiert.",
          brief:
            "Route, Shell und Zonen sind bereit. Der detaillierte Workflow Canvas und das Interaction Model werden in einer separaten Aufgabe gebaut.",
          zones: [
            {
              label: "Trigger",
              title: "Signal and condition",
              copy: "Eine spätere Zone für den Start eines Automation Flow ohne generischen Low-Code Canvas."
            },
            {
              label: "Action",
              title: "Communication and tasks",
              copy: "Ein Bereich für spätere automatische Antworten, Aufgaben und Erinnerungen."
            },
            {
              label: "Report",
              title: "Operational feedback",
              copy: "Eine spätere Zone für Reporting, Wochenübersichten und Kontrolle."
            }
          ],
          direction: [
            "Sophisticated Automation Workspace.",
            "Trigger, Action, Kommunikation, Reminder und Reporting Flows.",
            "Klare Workflow-Visualisierung, kein generischer Low-Code-Klon."
          ]
        }
      }
    }
  };

  function getStoredLanguage() {
    const params = new URLSearchParams(window.location.search);
    const urlLanguage = params.get("lang");
    if (supportedLanguages.includes(urlLanguage)) return urlLanguage;

    try {
      const saved = window.localStorage.getItem(storageKey);
      if (supportedLanguages.includes(saved)) return saved;
    } catch (error) {
      return "bg";
    }

    return "bg";
  }

  function storeLanguage(language) {
    try {
      window.localStorage.setItem(storageKey, language);
    } catch (error) {
      return;
    }
  }

  function getValue(path, language = currentLanguage) {
    const segments = path.split(".");
    let value = translations[language];

    for (const segment of segments) {
      if (value && Object.prototype.hasOwnProperty.call(value, segment)) {
        value = value[segment];
      } else {
        value = undefined;
        break;
      }
    }

    if (value === undefined && language !== "bg") return getValue(path, "bg");
    return value;
  }

  function setMetaDescription(value) {
    const meta = document.querySelector("meta[name='description']");
    if (meta && value) meta.setAttribute("content", value);
  }

  function withLanguageParam(url, language = currentLanguage) {
    const [base, hash = ""] = url.split("#");
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}lang=${encodeURIComponent(language)}${hash ? `#${hash}` : ""}`;
  }

  function updateLinks() {
    const intakeUrl = withLanguageParam(`../index.html?intake=1&solution=${encodeURIComponent(intakeSolution)}`);
    demoCtaLinks.forEach((link) => {
      link.setAttribute("href", intakeUrl);
    });

    mainLinks.forEach((link) => {
      link.setAttribute("href", withLanguageParam("../index.html"));
    });

    solutionsLinks.forEach((link) => {
      link.setAttribute("href", withLanguageParam("../index.html#solutions"));
    });
  }

  function applyTranslations(language) {
    currentLanguage = supportedLanguages.includes(language) ? language : "bg";
    const page = getValue(`pages.${demoKey}`);
    if (!page) return;

    document.documentElement.lang = currentLanguage;
    document.title = page.title;
    setMetaDescription(page.meta);

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const value = getValue(element.dataset.i18n);
      if (typeof value === "string") element.textContent = value;
    });

    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      const value = getValue(element.dataset.i18nAriaLabel);
      if (typeof value === "string") element.setAttribute("aria-label", value);
    });

    document.querySelectorAll("[data-page-i18n]").forEach((element) => {
      const value = page[element.dataset.pageI18n];
      if (typeof value === "string") element.textContent = value;
    });

    document.querySelectorAll("[data-zone-index]").forEach((element) => {
      const zone = page.zones[Number(element.dataset.zoneIndex)];
      if (!zone) return;
      element.querySelector("[data-zone-label]").textContent = zone.label;
      element.querySelector("[data-zone-title]").textContent = zone.title;
      element.querySelector("[data-zone-copy]").textContent = zone.copy;
    });

    document.querySelectorAll("[data-direction-index]").forEach((element) => {
      const value = page.direction[Number(element.dataset.directionIndex)];
      if (typeof value === "string") element.textContent = value;
    });

    languageButtons.forEach((button) => {
      const isActive = button.dataset.demoLang === currentLanguage;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
      if (isActive) {
        button.setAttribute("aria-current", "true");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    updateLinks();
  }

  let currentLanguage = getStoredLanguage();
  storeLanguage(currentLanguage);

  languageButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!supportedLanguages.includes(button.dataset.demoLang)) return;
      storeLanguage(button.dataset.demoLang);
      applyTranslations(button.dataset.demoLang);
    });
  });

  applyTranslations(currentLanguage);
})();
