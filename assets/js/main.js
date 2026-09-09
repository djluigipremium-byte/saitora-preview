(function () {
  "use strict";

  const storageKey = "saitora-language";
  const supportedLanguages = ["bg", "en", "de"];

  const body = document.body;
  const header = document.querySelector("[data-header]");
  const navToggle = document.querySelector("[data-nav-toggle]");
  const navMenu = document.querySelector("[data-nav-menu]");
  const navLinks = navMenu ? Array.from(navMenu.querySelectorAll("a[href^='#']")) : [];
  const languageButtons = Array.from(document.querySelectorAll("[data-lang-option]"));
  const solutionTabs = Array.from(document.querySelectorAll("[data-solution-tab]"));
  const solutionPanels = Array.from(document.querySelectorAll("[data-solution-panel]"));
  const solutionDemoLinks = Array.from(document.querySelectorAll("[data-demo-link]"));
  const modal = document.querySelector("[data-modal]");
  const modalDialog = modal ? modal.querySelector(".modal-dialog") : null;
  const modalTitle = modal ? modal.querySelector("[data-modal-title]") : null;
  const modalLabel = modal ? modal.querySelector("[data-modal-label]") : null;
  const modalDescription = modal ? modal.querySelector("[data-modal-description]") : null;
  const modalVisual = modal ? modal.querySelector("[data-modal-visual]") : null;
  const modalFeatures = modal ? modal.querySelector("[data-modal-features]") : null;
  const modalCloseButton = modal ? modal.querySelector(".modal-close") : null;
  const modalCloseButtons = modal ? modal.querySelectorAll("[data-modal-close]") : [];
  const projectIntake = document.querySelector("[data-project-intake]");
  const projectIntakePanel = projectIntake ? projectIntake.querySelector(".project-intake-panel") : null;
  const projectIntakeOpeners = Array.from(document.querySelectorAll("[data-open-project-intake]"));
  const projectIntakeCloseButtons = projectIntake ? projectIntake.querySelectorAll("[data-close-project-intake]") : [];
  const intakeForm = projectIntake ? projectIntake.querySelector("[data-project-intake-form]") : null;
  const intakeSteps = projectIntake ? Array.from(projectIntake.querySelectorAll("[data-intake-step]")) : [];
  const intakeProgressText = projectIntake ? projectIntake.querySelector("[data-intake-progress-text]") : null;
  const intakeProgressDots = projectIntake ? Array.from(projectIntake.querySelectorAll("[data-intake-progress-dot]")) : [];
  const intakeSolutions = projectIntake ? projectIntake.querySelector("[data-intake-solutions]") : null;
  const intakePriorities = projectIntake ? projectIntake.querySelector("[data-intake-priorities]") : null;
  const intakeRecommendation = projectIntake ? projectIntake.querySelector("[data-intake-recommendation]") : null;
  const intakeBackButton = projectIntake ? projectIntake.querySelector("[data-intake-back]") : null;
  const intakeNextButton = projectIntake ? projectIntake.querySelector("[data-intake-next]") : null;
  const intakeCopyButton = projectIntake ? projectIntake.querySelector("[data-intake-copy]") : null;
  const intakeDraftNote = projectIntake ? projectIntake.querySelector("[data-intake-draft-note]") : null;
  const intakeStatus = projectIntake ? projectIntake.querySelector("[data-intake-status]") : null;
  const intakeErrors = projectIntake
    ? Array.from(projectIntake.querySelectorAll("[data-intake-error]")).reduce((errors, element) => {
        errors[element.dataset.intakeError] = element;
        return errors;
      }, {})
    : {};
  const intakeFields = intakeForm
    ? Array.from(intakeForm.querySelectorAll("[data-intake-field]")).reduce((fields, element) => {
        fields[element.dataset.intakeField] = element;
        return fields;
      }, {})
    : {};
  const currentYear = document.getElementById("current-year");
  const demoRoutes = {
    signature: "demos/signature.html",
    capture: "demos/capture.html",
    booking: "demos/booking-os.html",
    command: "demos/command.html",
    portal: "demos/portal.html",
    automate: "demos/automate.html"
  };
  const intakeSolutionAliases = {
    "booking-os": "booking"
  };

  const projectLinks = {
    "wealthmatrix": {
      "live": "https://wealth-matrix-luigi.web.app"
    },
    "graveknight": {
      "demo": "demos/grave-knight/"
    },
    "snakeluigi": {
      "demo": "demos/snake-luigi/"
    },
    "partizala": {
      "live": "https://partizala.com"
    },
    "mikicharli": {
      "live": "https://mikicharli.com"
    },
    "bocalculator": {
      "demo": "demos/bo-calculator/",
      "live": "https://djluigipremium-byte.github.io/bo-calculator/"
    },
    "him": {
      "live": "https://hivem.app"
    }
  };

  const projectVisuals = {
    him: `<svg viewBox="0 0 760 460" focusable="false"><rect x="250" y="120" width="260" height="220" rx="14"></rect><path d="M330 200v-26a50 50 0 0 1 100 0v26"></path><rect x="352" y="236" width="56" height="44" rx="8"></rect><path d="M120 90h90M120 130h60M550 330h90M600 370h40"></path></svg>`,
    oblast: `<svg viewBox="0 0 760 460" focusable="false"><rect x="70" y="70" width="240" height="320" rx="8"></rect><path d="M104 120h172M104 156h140M104 192h172M104 228h96"></path><path d="M340 230h80"></path><rect x="450" y="120" width="240" height="90" rx="8"></rect><path d="M482 152h120M482 180h72"></path><rect x="450" y="260" width="240" height="130" rx="8"></rect><path d="M482 300h176M482 336h96M482 364h140"></path></svg>`,
    roadguard: `<svg viewBox="0 0 760 460" focusable="false"><path d="M120 400 300 90h160l180 310"></path><path d="M380 120v40M380 200v40M380 280v40M380 360v20"></path><rect x="120" y="60" width="120" height="80" rx="10"></rect><path d="M150 100h60"></path><circle cx="560" cy="150" r="46"></circle><path d="M540 150h40M560 130v40"></path></svg>`,
    wealthmatrix: `<svg viewBox="0 0 760 460" focusable="false"><rect x="80" y="90" width="600" height="280" rx="12"></rect><path d="M130 300l90-70 80 46 96-120 92 74 82-104"></path><path d="M130 340h500"></path><rect x="120" y="130" width="110" height="46" rx="8"></rect><rect x="256" y="130" width="110" height="46" rx="8"></rect><rect x="392" y="130" width="110" height="46" rx="8"></rect></svg>`
  };

  const translations = {
    bg: {
      meta: {
        title: "Saitora | Сайтове и дигитални системи за бизнес",
        description:
          "SAITORA създава премиум фирмени сайтове, онлайн магазини, системи за заявки, резервации и автоматизации за бизнеси, които искат по-силно онлайн присъствие.",
        ogLocale: "bg_BG"
      },
      skipLink: "Към съдържанието",
      brand: {
        home: "SAITORA начало"
      },
      nav: {
        aria: "Основна навигация",
        openMenu: "Отвори меню",
        closeMenu: "Затвори меню",
        home: "Начало",
        services: "Какво правим",
        solutions: "Решения",
        projects: "Проекти",
        process: "Процес",
        about: "За нас",
        cta: "Започни проект"
      },
      language: {
        label: "Език"
      },
      hero: {
        eyebrow: "София, България · saitora.tech",
        title: {
          line1: "Сайтове и дигитални",
          line2: "системи, които движат",
          line3: "бизнеса напред."
        },
        lead:
          "От премиум фирмен сайт до онлайн магазин, система за заявки, резервации и автоматизации - Saitora изгражда дигиталната основа на вашия бизнес.",
        primary: "Започни проект",
        secondary: "Виж какво можем",
        valueLine: "Сайт · Заявки · Резервации · Онлайн продажби · Автоматизации",
        visualAria: "Абстрактна визуализация на уебсайт, заявки, календар и дигитална система",
        panels: {
          website: "Премиум сайт",
          enquiry: "Път на заявката",
          calendar: "Календар",
          operations: "Операции",
          content: "Система за съдържание"
        }
      },
      services: {
        kicker: "Какво правим",
        title: "Дигитална основа за растящ бизнес.",
        items: {
          web: {
            title: "Премиум фирмени сайтове",
            copy:
              "Ясен, бърз и добре структуриран сайт, който представя услугите ви професионално и изгражда доверие."
          },
          shop: {
            title: "Онлайн магазини и продажби",
            copy: "Подреден e-commerce процес, който води клиента от първия поглед до поръчката."
          },
          booking: {
            title: "Заявки, календари и резервации",
            copy:
              "Форми, свободни часове, заявки и процеси, които намаляват ръчната комуникация и пропуснатите възможности."
          },
          systems: {
            title: "Автоматизации и дигитални системи",
            copy:
              "Практични решения за повтарящи се задачи, клиентски запитвания, вътрешни процеси и по-добра организация."
          }
        }
      },
      audiences: {
        kicker: "За кого",
        title: "За бизнеси, при които всяка заявка има значение.",
        lead:
          "Работим с компании, които имат реална стойност за предлагане и искат по-добър начин да се представят, да управляват запитванията си и да развиват процесите си.",
        items: {
          highValue: {
            title: "Услуги с висока стойност",
            copy: "Строителство, ремонти, интериор, почистване, авто услуги, охрана и специализирани B2B услуги."
          },
          bookings: {
            title: "Резервации и събития",
            copy: "Парти зали, event локации, студиа, вили, хотели, спортни услуги, обучения и наеми."
          },
          sales: {
            title: "Продажби и брандове",
            copy:
              "Онлайн магазини, премиум продукти, локални брандове и бизнеси, които искат по-силен дигитален образ."
          },
          operations: {
            title: "Екипи и операции",
            copy: "Компании с вътрешни процеси, служители, задачи, клиенти и нужда от по-добър контрол."
          }
        }
      },
      solutions: {
        kicker: "Решения",
        title: "Решения, които растат с бизнеса",
        lead:
          "Гъвкави отправни точки за сайтове, заявки, резервации, вътрешни системи, клиентски портали и автоматизации - изградени според реалния процес, не като готов пакет.",
        switcherAria: "Избор на решение",
        demo: "Илюстративен пример",
        suitable: "Подходящо за",
        cta: "Разгледай решението",
        demoLink: "Разгледай демо",
        items: {
          signature: {
            category: "Премиум уебсайт",
            headline: "Сайт, който изгражда доверие преди първия разговор.",
            description:
              "Индивидуален фирмен сайт за бизнеси, които искат по-силно онлайн присъствие, ясна стойност и по-добро първо впечатление.",
            suitable:
              "Премиум услуги, студиа, строителни и интериорни компании, хотели, клиники и брандове.",
            previewAria: "Илюстративен интерфейс за Atelier No. 8",
            demo: {
              navWork: "Проекти",
              navServices: "Услуги",
              navContact: "Запитване",
              eyebrow: "Интериор и архитектура",
              hero: "Spaces with character",
              button: "Изпрати запитване",
              serviceOne: "Концепция",
              serviceTwo: "Изпълнение",
              serviceThree: "Детайл"
            },
            capabilities: {
              design: "Индивидуален дизайн",
              mobile: "Мобилна версия",
              languages: "Многоезичност",
              enquiries: "Структура за запитвания",
              seo: "Основна SEO основа"
            }
          },
          capture: {
            category: "Заявки и CRM",
            headline: "Всяка заявка влиза в подреден процес.",
            description:
              "Сайт и система за запитвания, която събира клиенти, оферти и следващи действия на едно място.",
            suitable: "Почистване, ремонти, строителство, авто услуги, имоти и B2B услуги.",
            previewAria: "Илюстративен CRM интерфейс за ProClean Sofia",
            preview: {
              leads: "Нови заявки",
              conversion: "Конверсия 34%"
            },
            demo: {
              title: "Заявки",
              followUp: "Следващи действия",
              newLeads: "Нови заявки",
              inProgress: "В обработка",
              conversion: "Конверсия",
              statusNew: "Нова",
              statusOffer: "Оферта",
              statusConfirmed: "Потвърдена",
              taskLabel: "Задача",
              task: "Обади се до 14:00",
              activity: "Активност",
              activityText: "Офертата е изпратена преди 12 мин."
            },
            capabilities: {
              forms: "Форми според услугата",
              statuses: "Нови заявки и статуси",
              clients: "Клиентски профили",
              offers: "Оферти и follow-up",
              alerts: "Известия за екипа"
            }
          },
          booking: {
            category: "Резервации и календар",
            headline: "Резервации, капара и календар без хаос.",
            description:
              "Дигитална система за бизнеси, при които свободните дати, потвържденията и плащанията трябва да са видими в реално време.",
            suitable:
              "Парти зали, event локации, студиа, вили, хотели, коли под наем, спортни услуги и обучения.",
            previewAria: "Илюстративен booking интерфейс за Luma Event Hall",
            demo: {
              title: "Календар",
              month: "Юли 2026",
              eventOne: "Детски рожден ден",
              dateOne: "12 юли",
              eventTwo: "Фирмено събитие",
              dateTwo: "18 юли",
              eventThree: "Частно парти",
              dateThree: "26 юли",
              depositPaid: "Капаро получено",
              waitingPayment: "Чака плащане",
              confirmed: "Потвърдени събития",
              unpaid: "Неплатени суми",
              revenue: "Приход този месец"
            },
            capabilities: {
              calendar: "Календар със свободни дати",
              requests: "Заявки за резервация",
              statuses: "Потвърждения и статуси",
              deposits: "Капара и плащания",
              history: "Клиентска история"
            }
          },
          command: {
            category: "Вътрешна бизнес система",
            headline: "Контрол върху екипа, задачите и операциите.",
            description:
              "Частна система за вътрешна организация, при която екипът работи по ясни задачи, статуси, клиенти и реални процеси.",
            suitable: "Фирми с екипи, обекти, полеви служители, активни процеси и нужда от контрол.",
            previewAria: "Илюстративен operations интерфейс за NordBuild Operations",
            demo: {
              live: "Активно",
              approvals: "Чакащи одобрения",
              workload: "Натоварване екип",
              feedOne: "Документът е одобрен",
              feedTwo: "Задача е възложена",
              feedThree: "Нов обект е добавен",
              summary: "Месечна оперативна справка"
            },
            capabilities: {
              roles: "Роли и достъп",
              tasks: "Задачи и срокове",
              requests: "Вътрешни заявки",
              reports: "Оперативни справки",
              dashboard: "Dashboard за мениджъра"
            }
          },
          portal: {
            category: "Клиентски портал",
            headline: "Дайте на клиента яснота, без безкрайни имейли.",
            description:
              "Личен клиентски портал за проекти, документи, оферти, статуси, плащания и комуникация.",
            suitable:
              "Строителни фирми, интериорни студиа, агенции, B2B услуги, имоти и премиум поддръжка.",
            previewAria: "Илюстративен portal интерфейс за Forma Studio Portal",
            demo: {
              greeting: "Здравейте, Мария",
              project: "Апартамент Лозенец",
              progress: "70% завършен",
              payment: "Следващо плащане",
              meeting: "Среща",
              meetingTime: "14 юли, 15:00",
              activity: "Нова версия на проекта е качена."
            },
            capabilities: {
              profile: "Клиентски профил",
              docs: "Документи и файлове",
              payments: "Оферти и плащания",
              status: "Статус на проект",
              history: "История и известия"
            }
          },
          automate: {
            category: "Автоматизации",
            headline: "По-малко ръчни действия. Повече контрол.",
            description:
              "Автоматизации, които свързват заявки, клиенти, задачи, имейли, оферти, напомняния и отчети в един по-подреден процес.",
            suitable:
              "Бизнеси с много заявки, повторяеми действия и екипи, които губят време в ръчни процеси.",
            previewAria: "Илюстративен automation интерфейс за Aurelia Auto Care",
            demo: {
              title: "Работен поток",
              summary: "12 автоматизации изпълнени тази седмица",
              trigger: "Тригер",
              automatic: "Автоматично",
              sent: "Изпратено",
              taskCreated: "Задача създадена",
              scheduled: "Планирано",
              ready: "Готов"
            },
            capabilities: {
              replies: "Автоматични отговори",
              tasks: "Задачи към служители",
              reminders: "Напомняния за плащания",
              pdf: "PDF оферти и договори",
              reports: "Седмични отчети и AI класификация"
            },
            flow: {
              new: "Нова заявка",
              reply: "Автоматичен отговор",
              task: "Задача към екипа",
              reminder: "Напомняне за плащане",
              report: "Седмичен отчет"
            }
          }
        }
      },
      projects: {
        kicker: "Проекти",
        title: "Проекти с ясна функция.",
        view: "Виж проекта",
        demo: "Отвори демото",
        live: "Отвори сайта",
        private: "Проектът е частен - показани са само описание и функции.",
        items: {
          graveknight: {
            label: "Поръчкова разработка",
            title: "Grave Knight",
            type: "Браузърна игра за рекламна кампания",
            copy: "Екшън игра с нива и битки с босове, поръчана като част от кампания. Върви директно в браузъра, без инсталация и без плъгини."
          },
          snakeluigi: {
            label: "Поръчкова разработка",
            title: "Snake Luigi",
            type: "Игра като добавка към сайт",
            copy: "Класическа змия, поръчана като допълнение към сайт. Управлява се с клавиатура, с бутони на екрана и с плъзгане на телефон."
          },
          partizala: {
            label: "Реален проект",
            title: "Partizala",
            type: "Сайт и заявки за парти зала",
            copy: "Сайт на парти зала в София с галерия на пространството, подробности за наема и заявка за свободна дата."
          },
          mikicharli: {
            label: "Реален проект",
            title: "Мики и Чарли",
            type: "Сайт за детски аниматори",
            copy: "Сайт на двама клоуни аниматори за детски рождени дни в София, с програма на спектаклите, галерия и запитване за събитие."
          },
          bocalculator: {
            label: "Поръчкова разработка",
            title: "Beneficial Ownership Calculator",
            type: "Калкулатор за дялово участие",
            copy: "Калкулатор за действителни собственици при многослойни акционерни структури. Изчислява процентното участие през нивата."
          },
          him: {
            label: "Частна поръчка",
            title: "HIM — Mission Control",
            type: "Затворена работна среда",
            copy: "Работно приложение с отделна самоличност и вход през Firebase. Достъпът е само за одобрени профили."
          },
          oblast: {
            label: "Частна поръчка",
            title: "Област · Демо",
            type: "Дигитализация на общински документи",
            copy: "Справка върху сканирани административни документи, при която всяко число на екрана идва от проверена SQL заявка, а не от езиков модел."
          },
          roadguard: {
            label: "Частна поръчка",
            title: "RoadGuard",
            type: "Анализ на пътен трафик",
            copy: "Модулна платформа за анализ на пътния трафик. Разработка по специализирана поръчка; кодът е частен."
          },
          wealthmatrix: {
            label: "Частна поръчка",
            title: "Wealth Matrix",
            type: "Система за проследяване на активи",
            copy: "Затворена система за преглед и проследяване на лично имущество. Разработка по поръчка; кодът е частен."
          }
        }
      },
      process: {
        kicker: "Процес",
        title: "От идея до работеща система.",
        steps: {
          discovery: {
            title: "Разговор",
            copy: "Изясняваме как работи бизнесът ви, какво липсва и каква е реалната цел."
          },
          structure: {
            title: "Структура и дизайн",
            copy: "Изграждаме ясна архитектура, потребителски път и визуална посока."
          },
          build: {
            title: "Изработка",
            copy: "Превръщаме концепцията в бърз, responsive и подреден дигитален продукт."
          },
          launch: {
            title: "Пускане и развитие",
            copy: "Стартираме, наблюдаваме и надграждаме според реалната употреба."
          }
        }
      },
      about: {
        kicker: "За нас",
        title: "Кои сме ние",
        intro: {
          p1:
            "Saitora е създадена от хора, които комбинират над 15 години практически опит с дигитални инструменти, компютърни технологии и реални бизнес процеси.",
          p2:
            "Работим по дигитални проекти още от 2009 г. - с фокус върху решения, които не просто изглеждат добре, а помагат на бизнеса да се представя по-силно, да организира работата си по-добре и да обслужва клиентите си по-ясно.",
          p3:
            "За нас добрият дигитален продукт не е просто красив сайт. Той трябва да има ясна роля: да представя, да организира, да приема заявки, да продава или да спестява време."
        },
        strengthsAria: "Силни страни",
        founders: {
          nikolay: {
            role: "Операции и дигитални системи",
            name: "Николай Неделчев",
            p1:
              "Николай Неделчев комбинира опит в оперативното управление, бизнес анализа, координацията на екипи и изграждането на по-добри работни процеси.",
            p2:
              "Още от 14-годишна възраст развива практически интерес и умения в областта на компютърните технологии, дигиталните инструменти и създаването на решения, които работят ясно и надеждно за хората, които ги използват.",
            p3:
              "Професионалният му път включва управление на операции, планиране на ресурси, координация на екипи, работа с клиенти, организация на събития и оптимизиране на процеси в динамична международна среда.",
            p4:
              "В Saitora Николай превръща реалните нужди на бизнеса в ясни дигитални решения - премиум сайтове, системи за заявки, календари, резервации, вътрешни процеси и по-добре организирано клиентско обслужване.",
            strengths: {
              operations: "Оперативно управление",
              analysis: "Бизнес анализ",
              process: "Подобряване на процеси",
              client: "Клиентски път и заявки",
              teams: "Екипи и планиране",
              events: "Събития и координация"
            }
          },
          tahir: {
            role: "Технологии и разработка",
            name: "Тахир Муевлу",
            p1:
              "Тахир Муевлу е технологично ориентиран разработчик с дългогодишен интерес към high-end технологии, софтуерни продукти и прецизна дигитална разработка.",
            p2:
              "Неговият подход е насочен към стабилна техническа основа, чиста логика, добре организирана архитектура и детайлите, които превръщат една добра идея в надежден дигитален продукт.",
            p3:
              "Тахир е участвал в разработването на специализиран дигитален продукт за стоматолози и зъботехници с международна употреба. Този опит носи практическа перспектива за това как се изграждат системи, които трябва да бъдат едновременно интуитивни, точни и устойчиви при ежедневна реална работа.",
            p4:
              "В Saitora неговият фокус е върху съвременната функционалност, техническата надеждност, структурата на продукта и решенията, които могат да се развиват заедно с бизнеса във времето.",
            strengths: {
              dev: "Софтуерна разработка",
              architecture: "Продуктова архитектура",
              highEnd: "High-end технологии",
              logic: "Системна логика",
              reliability: "Надеждна функционалност",
              products: "Дигитални продукти"
            }
          }
        }
      },
      why: {
        overline: "практически опит от 2009 г. · над 15 години опит",
        title: "Защо Saitora",
        p1:
          "Практическият ни опит започва през 2009 г. и се развива повече от 15 години - от работа с компютърни технологии и дигитални инструменти до изграждане на системи, процеси и продукти, ориентирани към реални бизнес нужди.",
        p2:
          "Saitora обединява две гледни точки, които рядко се срещат на едно място: разбиране за реалната работа на бизнеса и силна техническа реализация.",
        p3:
          "Не започваме с готов шаблон. Първо разбираме как работите, как клиентите ви вземат решения и къде губите време. След това изграждаме сайт или дигитална система с ясна роля: да представя, да организира, да приема заявки, да продава или да автоматизира.",
        p4:
          "Работим с внимание към детайла, но без излишна сложност. Целта е продуктът да изглежда премиум, да работи надеждно и да бъде полезен дълго след пускането му.",
        pillars: {
          business: {
            title: "Първо разбираме бизнеса",
            copy: "Решението започва от процеса, не от готов шаблон."
          },
          function: {
            title: "Дизайн с ясна функция",
            copy: "Всяка секция, екран и действие има конкретна цел."
          },
          tech: {
            title: "Технологии, които работят",
            copy: "Стабилна основа, чиста логика и възможност за развитие."
          },
          premium: {
            title: "Премиум без излишна сложност",
            copy: "Силно присъствие, лесно използване и реална стойност."
          }
        }
      },
      contact: {
        location: "София, България"
      },
      footer: {
        copy: "Дигитални решения за бизнеси, които искат да работят по-ясно.",
        contactAria: "Контакти",
        phoneLabel: "Телефон",
        emailLabel: "Имейл",
        locationLabel: "Локация",
        privacy: "Политика за поверителност",
        terms: "Общи условия"
      },
      projectIntake: {
        close: "Затвори прозореца",
        kicker: "Проектен брифинг",
        title: "Нека подредим началото.",
        description:
          "Отговорете на няколко кратки въпроса и ще получите готов имейл със структуриран проектен бриф.",
        progress: "Стъпка {current} от 3",
        selected: "Избрано",
        step1: {
          label: "Стартова точка",
          title: "Какво искате да изградите първо?",
          helper: "Изберете най-близката отправна точка. Ако не сте сигурни, това също е валиден избор.",
          groupAria: "Избор на решение"
        },
        step2: {
          label: "Приоритети",
          title: "Какво трябва да се подобри?",
          helper: "Изберете до две основни цели, за да стане запитването по-фокусирано.",
          groupAria: "Избор на приоритети",
          recommendation: "Препоръчана отправна точка",
          unsure:
            "Saitora ще помогне да определите правилната отправна точка по време на първия разговор."
        },
        step3: {
          label: "Кратък бриф",
          title: "Кажете ни най-важното.",
          helper:
            "Тези данни остават във вашия браузър, докато не отворите готовия имейл или не копирате брифа."
        },
        solutions: [
          {
            key: "signature",
            name: "Saitora Signature",
            category: "Премиум уебсайт",
            description: "Силен фирмен сайт за доверие, ясна стойност и премиум присъствие."
          },
          {
            key: "capture",
            name: "Saitora Capture",
            category: "Запитвания и CRM",
            description: "Подреден процес за входящи запитвания, клиенти и последващи действия."
          },
          {
            key: "booking",
            name: "Saitora Booking OS",
            category: "Резервации, календар и плащания",
            description: "По-ясно управление на дати, наличности, резервации и плащания."
          },
          {
            key: "command",
            name: "Saitora Command",
            category: "Вътрешна оперативна система",
            description: "Екипи, задачи, статуси и вътрешни процеси на едно място."
          },
          {
            key: "portal",
            name: "Saitora Portal",
            category: "Клиентски портал",
            description: "Ясно пространство за проекти, документи, статуси и комуникация."
          },
          {
            key: "automate",
            name: "Saitora Automate",
            category: "Бизнес автоматизации",
            description: "По-малко ръчни действия чрез свързани процеси и автоматични стъпки."
          },
          {
            key: "unsure",
            name: "Не съм сигурен/сигурна",
            category: "Помогнете ми да избера",
            description: "Валиден избор, ако искате първо да уточним правилната посока."
          }
        ],
        priorities: [
          { key: "qualified", label: "Повече качествени запитвания" },
          { key: "leads", label: "Подредени лийдове и клиентска комуникация" },
          { key: "bookings", label: "Управление на резервации, наличности и плащания" },
          { key: "operations", label: "Задачи, екипи и операции на едно място" },
          { key: "portal", label: "По-ясно проектно пространство за клиентите" },
          { key: "manual", label: "По-малко повтаряща се ръчна работа" },
          { key: "presence", label: "По-силно премиум онлайн присъствие" }
        ],
        form: {
          name: "Име",
          email: "Имейл",
          business: "Бизнес / бранд",
          phone: "Телефон",
          context: "Кратък контекст / от какво има нужда бизнесът",
          timeline: "Предпочитан срок",
          timelinePlaceholder: "Изберете срок",
          timelines: {
            asap: "Възможно най-скоро",
            oneTwo: "До 1-2 месеца",
            three: "До 3 месеца",
            exploring: "Проучвам възможности"
          },
          consent:
            "Съгласен/съгласна съм Saitora да използва предоставената информация, за да отговори на моето запитване."
        },
        actions: {
          back: "Назад",
          next: "Продължи",
          openEmail: "Отвори готов имейл",
          copy: "Копирай запитването",
          draftNote:
            "Последната стъпка отваря готов имейл във вашия mail client. Нищо не се изпраща автоматично.",
          copied: "Запитването е копирано",
          copyFailed: "Копирането не беше успешно. Можете да маркирате и копирате текста ръчно."
        },
        errors: {
          solution: "Моля, изберете отправна точка.",
          maxPriorities: "Можете да изберете до два приоритета.",
          required: "Това поле е задължително.",
          email: "Моля, въведете валиден имейл адрес.",
          consent: "Моля, потвърдете съгласието, за да продължите."
        },
        email: {
          subject: "Ново запитване за проект към Saitora"
        },
        summary: {
          title: "Запитване за проект към Saitora",
          startingPoint: "Избрана отправна точка",
          priorities: "Основни приоритети",
          noPriorities: "Няма избрани приоритети",
          contact: "Контакт и бизнес",
          name: "Име",
          email: "Имейл",
          business: "Бизнес / бранд",
          phone: "Телефон",
          timeline: "Предпочитан срок",
          context: "Кратък контекст",
          notProvided: "Не е посочено"
        }
      },
      modal: {
        close: "Затвори прозореца",
        projects: {
          graveknight: {
            label: "Auftragsarbeit",
            title: "Grave Knight",
            description: "Ein Actionspiel, entwickelt als Teil einer Werbekampagne. Es läuft vollständig im Browser - ohne Installation, ohne Plugins, ohne Anmeldung.",
            featuresTitle: "Enthaltene Funktionen",
            features: ["Läuft vollständig im Browser", "Levels und Bosskämpfe", "Ton, Pause und Vollbild", "Hier direkt spielbar"]
          },
          snakeluigi: {
            label: "Auftragsarbeit",
            title: "Snake Luigi",
            description: "Ein Spiel als Website-Erweiterung, damit Besucher länger bleiben. Drei Steuerungsarten und eine Bestenliste.",
            featuresTitle: "Enthaltene Funktionen",
            features: ["Tastatur, Bildschirmtasten und Wischen", "Bestenliste", "Funktioniert auf Handy und Desktop", "Hier direkt spielbar"]
          },
          partizala: {
            label: "Reales Projekt",
            title: "Partizala",
            description: "Website für einen Partyraum zur Miete in Sofia. Sie zeigt den Raum, was die Miete umfasst, und nimmt Terminanfragen entgegen.",
            featuresTitle: "Enthaltene Funktionen",
            features: ["Galerie von Saal, Bar und Foyer", "Prüfung freier Termine", "Mietdetails und Leistungen", "Anfrageformular"]
          },
          mikicharli: {
            label: "Reales Projekt",
            title: "Мики и Чарли",
            description: "Website für zwei Kinderanimateure. Sie stellt das Programm Nummer für Nummer vor und nimmt Anfragen entgegen.",
            featuresTitle: "Enthaltene Funktionen",
            features: ["Programmvorstellung", "Galerie", "Anfrageformular", "Für die lokale Suche optimiert"]
          },
          bocalculator: {
            label: "Auftragsarbeit",
            title: "Beneficial Ownership Calculator",
            description: "Ein Werkzeug, das die effektive wirtschaftliche Berechtigung über mehrstufige Beteiligungsstrukturen berechnet, wenn Gesellschaften Anteile aneinander halten.",
            featuresTitle: "Enthaltene Funktionen",
            features: ["Mehrstufige Eigentümerstrukturen", "Effektiver Anteil über alle Ebenen", "Läuft vollständig im Browser", "Hier direkt testbar"]
          },
          him: {
            label: "Private Auftragsarbeit",
            title: "HIM — Mission Control",
            description: "Eine geschlossene Arbeitsumgebung mit eigener Identität und Firebase-Anmeldung. Die Inhalte sind nur für freigegebene Konten zugänglich, daher wird hier nur die Anmeldung gezeigt.",
            featuresTitle: "Enthaltene Funktionen",
            features: ["Firebase-Anmeldung", "Identität getrennt vom privaten Konto", "Nur freigegebene Konten"]
          },
          oblast: {
            label: "Private Auftragsarbeit",
            title: "Област · Демо",
            description: "Ein Projekt zur Digitalisierung kommunaler Akten. Es beantwortet, wie viele Personen überfällige Forderungen haben und in welcher Höhe - als Summe geprüfter Zeilen, nicht als Satz eines Modells. Die Abfrage steht neben der Zahl. Die Demo läuft auf vollständig erfundenen Daten.",
            featuresTitle: "Enthaltene Funktionen",
            features: ["Extraktion aus gescannten Seiten", "Jede Zahl aus geprüfter SQL-Abfrage", "Abfrage neben dem Ergebnis sichtbar", "Demo mit synthetischen Daten"]
          },
          roadguard: {
            label: "Private Auftragsarbeit",
            title: "RoadGuard",
            description: "Eine modulare Plattform zur Verkehrsanalyse, entwickelt für einen Spezialauftrag. Code und Daten sind privat, daher gibt es hier weder Link noch Screenshots.",
            featuresTitle: "Enthaltene Funktionen",
            features: ["Modularer Aufbau", "Verarbeitung von Videoströmen", "Spezialauftrag"]
          },
          wealthmatrix: {
            label: "Private Auftragsarbeit",
            title: "Wealth Matrix",
            description: "Ein geschlossenes System zur Übersicht und Verfolgung von Vermögenswerten. Private Auftragsarbeit - weder Code noch Daten sind öffentlich.",
            featuresTitle: "Enthaltene Funktionen",
            features: ["Vermögenswerte auf einen Blick", "Privater Code und private Daten", "Spezialauftrag"]
          }
        },
        legal: {
          privacy: {
            label: "Информационен текст",
            title: "Политика за поверителност",
            description:
              "Това е временен информационен текст за статичен сайт. Контактната форма не изпраща имейл и не записва заявка в база данни. Преди публична употреба съдържанието трябва да бъде съобразено с реалния начин на обработка на лични данни.",
            featuresTitle: "",
            features: []
          },
          terms: {
            label: "Информационен текст",
            title: "Общи условия",
            description:
              "Това е временен текст за място на бъдещи условия. Не съдържа правни твърдения, гаранции, цени, срокове или договорни клаузи. Реалните условия трябва да бъдат подготвени според конкретните услуги и процес на работа.",
            featuresTitle: "",
            features: []
          }
        }
      }
    },
    en: {
      meta: {
        title: "Saitora | Websites and Digital Systems for Business",
        description:
          "SAITORA creates premium business websites, online stores, enquiry systems, booking tools, and digital automations for businesses that want a stronger online presence.",
        ogLocale: "en_US"
      },
      skipLink: "Skip to content",
      brand: {
        home: "SAITORA home"
      },
      nav: {
        aria: "Main navigation",
        openMenu: "Open menu",
        closeMenu: "Close menu",
        home: "Home",
        services: "What we do",
        solutions: "Solutions",
        projects: "Projects",
        process: "Process",
        about: "About",
        cta: "Start a Project"
      },
      language: {
        label: "Language"
      },
      hero: {
        eyebrow: "Sofia, Bulgaria · saitora.tech",
        title: {
          line1: "Websites and digital",
          line2: "systems that move",
          line3: "business forward."
        },
        lead:
          "From a premium business website to an online store, enquiry system, booking flow, and automations - Saitora builds the digital foundation of your business.",
        primary: "Start a Project",
        secondary: "See what we do",
        valueLine: "Website · Enquiries · Bookings · Online sales · Automations",
        visualAria: "Abstract visualisation of a website, enquiries, calendar, and digital system",
        panels: {
          website: "Premium website",
          enquiry: "Enquiry flow",
          calendar: "Calendar",
          operations: "Operations",
          content: "Content system"
        }
      },
      services: {
        kicker: "What we do",
        title: "A digital foundation for a growing business.",
        items: {
          web: {
            title: "Premium Business Websites",
            copy:
              "A clear, fast, well-structured website that presents your services professionally and builds trust."
          },
          shop: {
            title: "Online Stores and Sales",
            copy: "An organised e-commerce flow that guides the customer from first view to order."
          },
          booking: {
            title: "Enquiries, Calendars and Bookings",
            copy:
              "Forms, available times, enquiries, and workflows that reduce manual communication and missed opportunities."
          },
          systems: {
            title: "Automation and Digital Systems",
            copy:
              "Practical solutions for repeated tasks, customer enquiries, internal workflows, and better organisation."
          }
        }
      },
      audiences: {
        kicker: "Who it is for",
        title: "For businesses where every enquiry matters.",
        lead:
          "We work with companies that have real value to offer and want a better way to present themselves, manage enquiries, and develop their processes.",
        items: {
          highValue: {
            title: "High-value services",
            copy: "Construction, renovation, interiors, cleaning, auto services, security, and specialist B2B services."
          },
          bookings: {
            title: "Bookings and events",
            copy: "Party venues, event locations, studios, villas, hotels, sports services, training, and rentals."
          },
          sales: {
            title: "Sales and brands",
            copy:
              "Online stores, premium products, local brands, and businesses that want a stronger digital image."
          },
          operations: {
            title: "Teams and operations",
            copy: "Companies with internal processes, employees, tasks, clients, and a need for better control."
          }
        }
      },
      solutions: {
        kicker: "Solutions",
        title: "Solutions that grow with the business",
        lead:
          "Flexible starting points for websites, enquiries, bookings, internal systems, client portals, and automations - built around the real process, not as a fixed package.",
        switcherAria: "Solution selector",
        demo: "Illustrative example",
        suitable: "Suitable for",
        cta: "Explore solution",
        demoLink: "View demo",
        items: {
          signature: {
            category: "Premium website",
            headline: "A website that builds trust before the first conversation.",
            description:
              "A custom business website for companies that want a stronger online presence, clearer value, and a better first impression.",
            suitable:
              "Premium services, studios, construction and interior companies, hotels, clinics, and brands.",
            previewAria: "Illustrative interface for Atelier No. 8",
            demo: {
              navWork: "Projects",
              navServices: "Services",
              navContact: "Enquiry",
              eyebrow: "Interior and architecture",
              hero: "Spaces with character",
              button: "Send enquiry",
              serviceOne: "Concept",
              serviceTwo: "Delivery",
              serviceThree: "Detail"
            },
            capabilities: {
              design: "Custom design",
              mobile: "Mobile version",
              languages: "Multilingual setup",
              enquiries: "Enquiry structure",
              seo: "Core SEO foundation"
            }
          },
          capture: {
            category: "Enquiries and CRM",
            headline: "Every enquiry enters an organised process.",
            description:
              "A website and enquiry system that keeps clients, offers, and next actions in one place.",
            suitable: "Cleaning, renovation, construction, auto services, real estate, and B2B services.",
            previewAria: "Illustrative CRM interface for ProClean Sofia",
            preview: {
              leads: "New leads",
              conversion: "Conversion 34%"
            },
            demo: {
              title: "Enquiries",
              followUp: "Follow-up",
              newLeads: "New enquiries",
              inProgress: "In progress",
              conversion: "Conversion",
              statusNew: "New",
              statusOffer: "Offer",
              statusConfirmed: "Confirmed",
              taskLabel: "Task",
              task: "Call by 14:00",
              activity: "Activity",
              activityText: "Offer sent 12 min ago."
            },
            capabilities: {
              forms: "Service-specific forms",
              statuses: "New enquiries and statuses",
              clients: "Client profiles",
              offers: "Offers and follow-up",
              alerts: "Team notifications"
            }
          },
          booking: {
            category: "Bookings and calendar",
            headline: "Bookings, deposits, and calendar without chaos.",
            description:
              "A digital system for businesses where available dates, confirmations, and payments need to be visible in real time.",
            suitable:
              "Party venues, event locations, studios, villas, hotels, car rentals, sports services, and training.",
            previewAria: "Illustrative booking interface for Luma Event Hall",
            demo: {
              title: "Calendar",
              month: "July 2026",
              eventOne: "Children's birthday",
              dateOne: "12 Jul",
              eventTwo: "Company event",
              dateTwo: "18 Jul",
              eventThree: "Private party",
              dateThree: "26 Jul",
              depositPaid: "Deposit received",
              waitingPayment: "Awaiting payment",
              confirmed: "Confirmed events",
              unpaid: "Unpaid amounts",
              revenue: "Revenue this month"
            },
            capabilities: {
              calendar: "Calendar with available dates",
              requests: "Booking requests",
              statuses: "Confirmations and statuses",
              deposits: "Deposits and payments",
              history: "Client history"
            }
          },
          command: {
            category: "Internal business system",
            headline: "Control over the team, tasks, and operations.",
            description:
              "A private internal organisation system where the team works with clear tasks, statuses, clients, and real processes.",
            suitable: "Companies with teams, sites, field staff, active workflows, and a need for control.",
            previewAria: "Illustrative operations interface for NordBuild Operations",
            demo: {
              live: "Live",
              approvals: "Pending approvals",
              workload: "Team workload",
              feedOne: "Document approved",
              feedTwo: "Task assigned",
              feedThree: "New site added",
              summary: "Monthly operations summary"
            },
            capabilities: {
              roles: "Roles and access",
              tasks: "Tasks and deadlines",
              requests: "Internal requests",
              reports: "Operational reports",
              dashboard: "Manager dashboard"
            }
          },
          portal: {
            category: "Client portal",
            headline: "Give clients clarity without endless emails.",
            description:
              "A private client portal for projects, documents, offers, statuses, payments, and communication.",
            suitable:
              "Construction companies, interior studios, agencies, B2B services, real estate, and premium support.",
            previewAria: "Illustrative portal interface for Forma Studio Portal",
            demo: {
              greeting: "Hello, Maria",
              project: "Lozenets Apartment",
              progress: "70% complete",
              payment: "Next payment",
              meeting: "Meeting",
              meetingTime: "14 July, 15:00",
              activity: "A new project version has been uploaded."
            },
            capabilities: {
              profile: "Client profile",
              docs: "Documents and files",
              payments: "Offers and payments",
              status: "Project status",
              history: "History and notifications"
            }
          },
          automate: {
            category: "Automations",
            headline: "Less manual work. More control.",
            description:
              "Automations that connect enquiries, clients, tasks, emails, offers, reminders, and reports into a more organised process.",
            suitable:
              "Businesses with many enquiries, repeated actions, and teams losing time in manual workflows.",
            previewAria: "Illustrative automation interface for Aurelia Auto Care",
            demo: {
              title: "Workflow",
              summary: "12 automations completed this week",
              trigger: "Trigger",
              automatic: "Automatic",
              sent: "Sent",
              taskCreated: "Task created",
              scheduled: "Scheduled",
              ready: "Ready"
            },
            capabilities: {
              replies: "Automatic replies",
              tasks: "Tasks for employees",
              reminders: "Payment reminders",
              pdf: "PDF offers and contracts",
              reports: "Weekly reports and AI classification"
            },
            flow: {
              new: "New enquiry",
              reply: "Automatic reply",
              task: "Task for team",
              reminder: "Payment reminder",
              report: "Weekly report"
            }
          }
        }
      },
      projects: {
        kicker: "Projects",
        title: "Projects with a clear function.",
        view: "View project",
        demo: "Open the demo",
        live: "Open the site",
        private: "This project is private - only a description and features are shown.",
        items: {
          graveknight: {
            label: "Commissioned work",
            title: "Grave Knight",
            type: "Browser game for a campaign",
            copy: "An action game with levels and boss fights, commissioned as part of a campaign. Runs straight in the browser, no install, no plugins."
          },
          snakeluigi: {
            label: "Commissioned work",
            title: "Snake Luigi",
            type: "Game as a website add-on",
            copy: "A classic snake game commissioned as an add-on for a website. Plays with the keyboard, on-screen buttons or swipe."
          },
          partizala: {
            label: "Real project",
            title: "Partizala",
            type: "Website and enquiries for a party venue",
            copy: "Website for a party venue in Sofia with a gallery of the space, rental details and a date-availability enquiry."
          },
          mikicharli: {
            label: "Real project",
            title: "Мики и Чарли",
            type: "Website for children's entertainers",
            copy: "Website for two clown entertainers for children's birthdays in Sofia, with their programme, a gallery and an event enquiry form."
          },
          bocalculator: {
            label: "Commissioned work",
            title: "Beneficial Ownership Calculator",
            type: "Shareholding calculator",
            copy: "A beneficial ownership calculator for multi-level shareholder structures. Works out effective percentages across the layers."
          },
          him: {
            label: "Private commission",
            title: "HIM — Mission Control",
            type: "Closed working environment",
            copy: "A working application with a separate identity and Firebase sign-in. Access is limited to approved accounts."
          },
          oblast: {
            label: "Private commission",
            title: "Област · Демо",
            type: "Digitising municipal records",
            copy: "A report over scanned administrative documents where every figure on screen comes from a verified SQL query, not from a language model."
          },
          roadguard: {
            label: "Private commission",
            title: "RoadGuard",
            type: "Traffic analytics",
            copy: "A modular road-traffic analytics platform. Built to a specialised brief; the code is private."
          },
          wealthmatrix: {
            label: "Private commission",
            title: "Wealth Matrix",
            type: "Asset tracking system",
            copy: "A closed system for reviewing and tracking personal assets. Built to order; the code is private."
          }
        }
      },
      process: {
        kicker: "Process",
        title: "From idea to working system.",
        steps: {
          discovery: {
            title: "Conversation",
            copy: "We clarify how your business works, what is missing, and what the real goal is."
          },
          structure: {
            title: "Structure and design",
            copy: "We build a clear architecture, user path, and visual direction."
          },
          build: {
            title: "Development",
            copy: "We turn the concept into a fast, responsive, and organised digital product."
          },
          launch: {
            title: "Launch and growth",
            copy: "We launch, observe, and improve based on real usage."
          }
        }
      },
      about: {
        kicker: "About",
        title: "Who we are",
        intro: {
          p1:
            "Saitora was created by people who combine over 15 years of practical experience with digital tools, computer technologies, and real business processes.",
          p2:
            "We have worked on digital projects since 2009 - focused on solutions that do not just look good, but help a business present itself more strongly, organise its work better, and serve customers more clearly.",
          p3:
            "For us, a good digital product is not just a beautiful website. It needs a clear role: to present, organise, receive enquiries, sell, or save time."
        },
        strengthsAria: "Strengths",
        founders: {
          nikolay: {
            role: "Operations and digital systems",
            name: "Nikolay Nedelchev",
            p1:
              "Николай Неделчев combines experience in operations management, business analysis, team coordination, and building better work processes.",
            p2:
              "Since the age of 14, he has developed a practical interest and skills in computer technologies, digital tools, and creating solutions that work clearly and reliably for the people who use them.",
            p3:
              "His professional path includes operations management, resource planning, team coordination, client work, event operations, and process improvement in a dynamic international environment.",
            p4:
              "At Saitora, Nikolay turns real business needs into clear digital solutions - premium websites, enquiry systems, calendars, bookings, internal workflows, and better organised customer service.",
            strengths: {
              operations: "Operations management",
              analysis: "Business analysis",
              process: "Process improvement",
              client: "Client journey and enquiries",
              teams: "Teams and planning",
              events: "Events and coordination"
            }
          },
          tahir: {
            role: "Technology and development",
            name: "Tahir Muevlu",
            p1:
              "Тахир Муевлу is a technology-oriented developer with a long-standing interest in high-end technologies, software products, and precise digital development.",
            p2:
              "His approach is focused on a stable technical foundation, clean logic, well-organised architecture, and the details that turn a good idea into a reliable digital product.",
            p3:
              "Tahir has participated in the development of a specialist digital product for dentists and dental technicians with international use. This experience brings a practical perspective on building systems that need to be intuitive, precise, and resilient in daily real-world work.",
            p4:
              "At Saitora, his focus is on modern functionality, technical reliability, product structure, and solutions that can evolve with the business over time.",
            strengths: {
              dev: "Software development",
              architecture: "Product architecture",
              highEnd: "High-end technologies",
              logic: "System logic",
              reliability: "Reliable functionality",
              products: "Digital products"
            }
          }
        }
      },
      why: {
        overline: "practical experience since 2009 · over 15 years of experience",
        title: "Why Saitora",
        p1:
          "Our practical experience began in 2009 and has developed over more than 15 years - from working with computer technologies and digital tools to building systems, processes, and products oriented around real business needs.",
        p2:
          "Saitora brings together two perspectives that rarely meet in one place: an understanding of real business work and strong technical execution.",
        p3:
          "We do not start with a ready-made template. First, we understand how you work, how your customers make decisions, and where you lose time. Then we build a website or digital system with a clear role: to present, organise, receive enquiries, sell, or automate.",
        p4:
          "We work with attention to detail, but without unnecessary complexity. The goal is a product that looks premium, works reliably, and remains useful long after launch.",
        pillars: {
          business: {
            title: "We understand the business first",
            copy: "The solution starts from the process, not from a ready-made template."
          },
          function: {
            title: "Design with a clear function",
            copy: "Every section, screen, and action has a specific purpose."
          },
          tech: {
            title: "Technology that works",
            copy: "A stable foundation, clean logic, and room to develop."
          },
          premium: {
            title: "Premium without unnecessary complexity",
            copy: "Strong presence, easy use, and real value."
          }
        }
      },
      contact: {
        location: "Sofia, Bulgaria"
      },
      footer: {
        copy: "Digital solutions for businesses that want to work with more clarity.",
        contactAria: "Contact details",
        phoneLabel: "Phone",
        emailLabel: "E-mail",
        locationLabel: "Location",
        privacy: "Privacy policy",
        terms: "Terms"
      },
      projectIntake: {
        close: "Close window",
        kicker: "Project Intake",
        title: "Let us shape the right starting point.",
        description:
          "Answer a few focused questions and create a prepared email with a structured project brief.",
        progress: "Step {current} of 3",
        selected: "Selected",
        step1: {
          label: "Starting point",
          title: "What do you want to build first?",
          helper: "Choose the closest starting point. If you are not sure yet, that is a valid choice.",
          groupAria: "Solution selection"
        },
        step2: {
          label: "Priorities",
          title: "What should improve?",
          helper: "Select up to two main goals so the enquiry stays focused.",
          groupAria: "Priority selection",
          recommendation: "Recommended starting point",
          unsure:
            "Saitora will help identify the right starting point during the initial conversation."
        },
        step3: {
          label: "Short brief",
          title: "Share the essentials.",
          helper:
            "This information stays in your browser until you open the prepared email or copy the brief."
        },
        solutions: [
          {
            key: "signature",
            name: "Saitora Signature",
            category: "Premium website",
            description: "A strong business website for trust, clear value, and premium presence."
          },
          {
            key: "capture",
            name: "Saitora Capture",
            category: "Enquiries and CRM",
            description: "An organised flow for enquiries, clients, and follow-up actions."
          },
          {
            key: "booking",
            name: "Saitora Booking OS",
            category: "Reservations, calendar, and payments",
            description: "Clearer management of dates, availability, bookings, and payments."
          },
          {
            key: "command",
            name: "Saitora Command",
            category: "Internal operations system",
            description: "Teams, tasks, statuses, and internal workflows in one place."
          },
          {
            key: "portal",
            name: "Saitora Portal",
            category: "Client portal",
            description: "A clear space for projects, documents, statuses, and communication."
          },
          {
            key: "automate",
            name: "Saitora Automate",
            category: "Business automations",
            description: "Less manual work through connected processes and automatic steps."
          },
          {
            key: "unsure",
            name: "Not sure yet",
            category: "Help me choose the right starting point",
            description: "A valid choice if you want to clarify the right direction first."
          }
        ],
        priorities: [
          { key: "qualified", label: "Generate more qualified enquiries" },
          { key: "leads", label: "Organise leads and customer communication" },
          { key: "bookings", label: "Manage bookings, availability, and payments" },
          { key: "operations", label: "Bring tasks, teams, and operations into one place" },
          { key: "portal", label: "Give clients a clearer project space" },
          { key: "manual", label: "Reduce repetitive manual work" },
          { key: "presence", label: "Build a stronger premium online presence" }
        ],
        form: {
          name: "Name",
          email: "E-mail",
          business: "Business / brand name",
          phone: "Phone number",
          context: "Short project context / what the business needs",
          timeline: "Preferred timeline",
          timelinePlaceholder: "Choose a timeline",
          timelines: {
            asap: "As soon as possible",
            oneTwo: "Within 1-2 months",
            three: "Within 3 months",
            exploring: "I am exploring options"
          },
          consent:
            "I agree that Saitora may use the information provided to respond to my enquiry."
        },
        actions: {
          back: "Back",
          next: "Continue",
          openEmail: "Open prepared email",
          copy: "Copy project brief",
          draftNote:
            "The final step opens a prepared email draft in your mail client. Nothing is sent automatically.",
          copied: "Project brief copied",
          copyFailed: "Copying was not successful. You can select and copy the text manually."
        },
        errors: {
          solution: "Please choose a starting point.",
          maxPriorities: "You can select up to two priorities.",
          required: "This field is required.",
          email: "Please enter a valid email address.",
          consent: "Please confirm consent before continuing."
        },
        email: {
          subject: "New Saitora Project Enquiry"
        },
        summary: {
          title: "Saitora project enquiry",
          startingPoint: "Selected starting point",
          priorities: "Main priorities",
          noPriorities: "No priorities selected",
          contact: "Contact and business",
          name: "Name",
          email: "E-mail",
          business: "Business / brand",
          phone: "Phone",
          timeline: "Preferred timeline",
          context: "Short project context",
          notProvided: "Not provided"
        }
      },
      modal: {
        close: "Close window",
        projects: {
          partizala: {
            label: "Real project",
            title: "Partizala",
            description:
              "A digital solution for a party venue with public information, booking and viewing enquiries, a calendar with occupied periods, and a more organised process for managing requests.",
            featuresTitle: "Included functionality",
            features: [
              "Premium presentation of the service",
              "Booking form",
              "Viewing enquiry form",
              "Calendar with occupied periods",
              "Clear incoming-enquiry process",
              "Mobile-first structure"
            ]
          },
          professional: {
            label: "Concept project",
            title: "Professional services",
            description:
              "A concept for a company that needs to explain expertise, services, and process without unnecessary noise. The focus is trust, clear enquiries, and practical structure.",
            featuresTitle: "Possible components",
            features: [
              "Business presentation",
              "Structured services",
              "Qualified enquiry form",
              "Process and approach section",
              "SEO foundation for services",
              "Clear direction for future growth"
            ]
          },
          hospitality: {
            label: "Concept project",
            title: "Hospitality and bookings",
            description:
              "A concept for a restaurant, hotel, or venue that needs presentation, event enquiries, bookings, and clearer availability management.",
            featuresTitle: "Possible components",
            features: [
              "Presentation of space or service",
              "Reservation and event forms",
              "Availability or calendar",
              "Contact and location",
              "Menu or package offers",
              "Organised mobile experience"
            ]
          }
        },
        legal: {
          privacy: {
            label: "Information text",
            title: "Privacy policy",
            description:
              "This is temporary information text for a static website. The contact form does not send email and does not store an enquiry in a database. Before public use, the content should reflect the real way personal data is processed.",
            featuresTitle: "",
            features: []
          },
          terms: {
            label: "Information text",
            title: "Terms",
            description:
              "This is temporary copy for future terms. It does not contain legal claims, guarantees, prices, timelines, or contract clauses. Real terms should be prepared according to the specific services and work process.",
            featuresTitle: "",
            features: []
          }
        }
      }
    },
    de: {
      meta: {
        title: "Saitora | Websites und digitale Systeme für Unternehmen",
        description:
          "SAITORA entwickelt hochwertige Unternehmenswebsites, Onlineshops, Anfrage- und Buchungssysteme sowie digitale Automatisierungen für Unternehmen mit Anspruch an einen stärkeren Online-Auftritt.",
        ogLocale: "de_DE"
      },
      skipLink: "Zum Inhalt springen",
      brand: {
        home: "SAITORA Startseite"
      },
      nav: {
        aria: "Hauptnavigation",
        openMenu: "Menü öffnen",
        closeMenu: "Menü schließen",
        home: "Start",
        services: "Leistungen",
        solutions: "Lösungen",
        projects: "Projekte",
        process: "Prozess",
        about: "Über uns",
        cta: "Projekt starten"
      },
      language: {
        label: "Sprache"
      },
      hero: {
        eyebrow: "Sofia, Bulgarien · saitora.tech",
        title: {
          line1: "Websites und digitale",
          line2: "Systeme, die Unternehmen",
          line3: "voranbringen."
        },
        lead:
          "Von der hochwertigen Unternehmenswebsite bis zum Onlineshop, Anfrage- und Buchungssystem oder zur Automatisierung - Saitora baut die digitale Grundlage Ihres Unternehmens.",
        primary: "Projekt starten",
        secondary: "Leistungen ansehen",
        valueLine: "Website · Anfragen · Buchungen · Online-Vertrieb · Automatisierung",
        visualAria: "Abstrakte Visualisierung einer Website, von Anfragen, Kalender und digitalem System",
        panels: {
          website: "Premium-Website",
          enquiry: "Anfrageprozess",
          calendar: "Kalender",
          operations: "Abläufe",
          content: "Content-System"
        }
      },
      services: {
        kicker: "Leistungen",
        title: "Eine digitale Grundlage für wachsende Unternehmen.",
        items: {
          web: {
            title: "Hochwertige Unternehmenswebsites",
            copy:
              "Eine klare, schnelle und gut strukturierte Website, die Ihre Leistungen professionell präsentiert und Vertrauen aufbaut."
          },
          shop: {
            title: "Onlineshops und Vertrieb",
            copy: "Ein geordneter E-Commerce-Prozess, der Kundinnen und Kunden vom ersten Eindruck bis zur Bestellung führt."
          },
          booking: {
            title: "Anfragen, Kalender und Buchungen",
            copy:
              "Formulare, freie Zeiten, Anfragen und Abläufe, die manuelle Kommunikation und verpasste Chancen reduzieren."
          },
          systems: {
            title: "Automatisierung und digitale Systeme",
            copy:
              "Praktische Lösungen für wiederkehrende Aufgaben, Kundenanfragen, interne Prozesse und bessere Organisation."
          }
        }
      },
      audiences: {
        kicker: "Für wen",
        title: "Für Unternehmen, bei denen jede Anfrage zählt.",
        lead:
          "Wir arbeiten mit Unternehmen, die echten Wert anbieten und sich besser präsentieren, Anfragen strukturierter verwalten und ihre Prozesse weiterentwickeln möchten.",
        items: {
          highValue: {
            title: "Hochwertige Dienstleistungen",
            copy:
              "Bau, Renovierung, Interior, Reinigung, Autodienstleistungen, Sicherheit und spezialisierte B2B-Dienstleistungen."
          },
          bookings: {
            title: "Buchungen und Events",
            copy: "Partyräume, Eventlocations, Studios, Villen, Hotels, Sportangebote, Schulungen und Vermietungen."
          },
          sales: {
            title: "Vertrieb und Marken",
            copy:
              "Onlineshops, hochwertige Produkte, lokale Marken und Unternehmen, die ein stärkeres digitales Bild aufbauen möchten."
          },
          operations: {
            title: "Teams und Abläufe",
            copy:
              "Unternehmen mit internen Prozessen, Mitarbeitenden, Aufgaben, Kunden und Bedarf an besserer Kontrolle."
          }
        }
      },
      solutions: {
        kicker: "Lösungen",
        title: "Lösungen, die mit dem Unternehmen wachsen",
        lead:
          "Flexible Ausgangspunkte für Websites, Anfragen, Buchungen, interne Systeme, Kundenportale und Automatisierungen - aufgebaut entlang des realen Prozesses, nicht als starres Paket.",
        switcherAria: "Lösung auswählen",
        demo: "Illustratives Beispiel",
        suitable: "Geeignet für",
        cta: "Lösung ansehen",
        demoLink: "Demo ansehen",
        items: {
          signature: {
            category: "Premium-Website",
            headline: "Eine Website, die Vertrauen schafft, bevor das erste Gespräch beginnt.",
            description:
              "Eine individuelle Unternehmenswebsite für Firmen, die einen stärkeren Online-Auftritt, klaren Wert und einen besseren ersten Eindruck wollen.",
            suitable: "Premium-Dienstleistungen, Studios, Bau- und Interior-Unternehmen, Hotels, Kliniken und Marken.",
            previewAria: "Illustrative Oberfläche für Atelier No. 8",
            demo: {
              navWork: "Projekte",
              navServices: "Leistungen",
              navContact: "Anfrage",
              eyebrow: "Interior und Architektur",
              hero: "Spaces with character",
              button: "Anfrage senden",
              serviceOne: "Konzept",
              serviceTwo: "Umsetzung",
              serviceThree: "Detail"
            },
            capabilities: {
              design: "Individuelles Design",
              mobile: "Mobile Version",
              languages: "Mehrsprachigkeit",
              enquiries: "Struktur für Anfragen",
              seo: "Solide SEO-Grundlage"
            }
          },
          capture: {
            category: "Anfragen und CRM",
            headline: "Jede Anfrage landet in einem geordneten Prozess.",
            description:
              "Website und Anfragesystem, das Kunden, Angebote und nächste Schritte an einem Ort bündelt.",
            suitable: "Reinigung, Renovierung, Bau, Autodienstleistungen, Immobilien und B2B-Dienstleistungen.",
            previewAria: "Illustrative CRM-Oberfläche für ProClean Sofia",
            preview: {
              leads: "Neue Anfragen",
              conversion: "Conversion 34%"
            },
            demo: {
              title: "Anfragen",
              followUp: "Follow-up",
              newLeads: "Neue Anfragen",
              inProgress: "In Bearbeitung",
              conversion: "Conversion",
              statusNew: "Neu",
              statusOffer: "Angebot",
              statusConfirmed: "Bestätigt",
              taskLabel: "Aufgabe",
              task: "Anruf bis 14:00",
              activity: "Aktivität",
              activityText: "Angebot vor 12 Min. gesendet."
            },
            capabilities: {
              forms: "Formulare nach Leistung",
              statuses: "Neue Anfragen und Status",
              clients: "Kundenprofile",
              offers: "Angebote und Follow-up",
              alerts: "Team-Benachrichtigungen"
            }
          },
          booking: {
            category: "Buchungen und Kalender",
            headline: "Buchungen, Anzahlungen und Kalender ohne Chaos.",
            description:
              "Ein digitales System für Unternehmen, bei denen freie Termine, Bestätigungen und Zahlungen in Echtzeit sichtbar sein müssen.",
            suitable:
              "Partyräume, Eventlocations, Studios, Villen, Hotels, Autovermietungen, Sportangebote und Schulungen.",
            previewAria: "Illustrative Buchungsoberfläche für Luma Event Hall",
            demo: {
              title: "Kalender",
              month: "Juli 2026",
              eventOne: "Kindergeburtstag",
              dateOne: "12. Juli",
              eventTwo: "Firmenevent",
              dateTwo: "18. Juli",
              eventThree: "Private Party",
              dateThree: "26. Juli",
              depositPaid: "Anzahlung erhalten",
              waitingPayment: "Zahlung ausstehend",
              confirmed: "Bestätigte Events",
              unpaid: "Offene Beträge",
              revenue: "Umsatz diesen Monat"
            },
            capabilities: {
              calendar: "Kalender mit freien Terminen",
              requests: "Buchungsanfragen",
              statuses: "Bestätigungen und Status",
              deposits: "Anzahlungen und Zahlungen",
              history: "Kundenhistorie"
            }
          },
          command: {
            category: "Internes Business-System",
            headline: "Kontrolle über Team, Aufgaben und Abläufe.",
            description:
              "Ein privates System für interne Organisation, in dem das Team mit klaren Aufgaben, Status, Kunden und realen Prozessen arbeitet.",
            suitable: "Unternehmen mit Teams, Standorten, Außendienst, aktiven Abläufen und Bedarf an Kontrolle.",
            previewAria: "Illustrative Operations-Oberfläche für NordBuild Operations",
            demo: {
              live: "Live",
              approvals: "Offene Freigaben",
              workload: "Teamauslastung",
              feedOne: "Dokument genehmigt",
              feedTwo: "Aufgabe zugewiesen",
              feedThree: "Neuer Standort hinzugefügt",
              summary: "Monatliche Operations-Auswertung"
            },
            capabilities: {
              roles: "Rollen und Zugriff",
              tasks: "Aufgaben und Fristen",
              requests: "Interne Anfragen",
              reports: "Operative Auswertungen",
              dashboard: "Dashboard für Management"
            }
          },
          portal: {
            category: "Kundenportal",
            headline: "Geben Sie Kunden Klarheit, ohne endlose E-Mails.",
            description:
              "Ein persönliches Kundenportal für Projekte, Dokumente, Angebote, Status, Zahlungen und Kommunikation.",
            suitable:
              "Bauunternehmen, Interior-Studios, Agenturen, B2B-Dienstleistungen, Immobilien und Premium-Support.",
            previewAria: "Illustrative Portal-Oberfläche für Forma Studio Portal",
            demo: {
              greeting: "Hallo, Maria",
              project: "Apartment Lozenets",
              progress: "70% abgeschlossen",
              payment: "Nächste Zahlung",
              meeting: "Termin",
              meetingTime: "14. Juli, 15:00",
              activity: "Eine neue Projektversion wurde hochgeladen."
            },
            capabilities: {
              profile: "Kundenprofil",
              docs: "Dokumente und Dateien",
              payments: "Angebote und Zahlungen",
              status: "Projektstatus",
              history: "Historie und Benachrichtigungen"
            }
          },
          automate: {
            category: "Automatisierungen",
            headline: "Weniger manuelle Schritte. Mehr Kontrolle.",
            description:
              "Automatisierungen, die Anfragen, Kunden, Aufgaben, E-Mails, Angebote, Erinnerungen und Berichte zu einem geordneteren Prozess verbinden.",
            suitable:
              "Unternehmen mit vielen Anfragen, wiederkehrenden Aufgaben und Teams, die Zeit in manuellen Prozessen verlieren.",
            previewAria: "Illustrative Automatisierungsoberfläche für Aurelia Auto Care",
            demo: {
              title: "Workflow",
              summary: "12 Automatisierungen diese Woche ausgeführt",
              trigger: "Trigger",
              automatic: "Automatisch",
              sent: "Gesendet",
              taskCreated: "Aufgabe erstellt",
              scheduled: "Geplant",
              ready: "Bereit"
            },
            capabilities: {
              replies: "Automatische Antworten",
              tasks: "Aufgaben für Mitarbeitende",
              reminders: "Zahlungserinnerungen",
              pdf: "PDF-Angebote und Verträge",
              reports: "Wochenberichte und AI-Klassifizierung"
            },
            flow: {
              new: "Neue Anfrage",
              reply: "Automatische Antwort",
              task: "Aufgabe ans Team",
              reminder: "Zahlungserinnerung",
              report: "Wochenbericht"
            }
          }
        }
      },
      projects: {
        kicker: "Projekte",
        title: "Projekte mit klarer Funktion.",
        view: "Projekt ansehen",
        demo: "Demo öffnen",
        live: "Website öffnen",
        private: "Dieses Projekt ist privat - gezeigt werden nur Beschreibung und Funktionen.",
        items: {
          graveknight: {
            label: "Auftragsarbeit",
            title: "Grave Knight",
            type: "Browserspiel für eine Kampagne",
            copy: "Ein Actionspiel mit Levels und Bosskämpfen, beauftragt als Teil einer Kampagne. Läuft direkt im Browser, ohne Installation."
          },
          snakeluigi: {
            label: "Auftragsarbeit",
            title: "Snake Luigi",
            type: "Spiel als Website-Erweiterung",
            copy: "Ein klassisches Snake-Spiel als Erweiterung für eine Website. Steuerung per Tastatur, Bildschirmtasten oder Wischen."
          },
          partizala: {
            label: "Reales Projekt",
            title: "Partizala",
            type: "Website und Anfragen für einen Partyraum",
            copy: "Website für einen Partyraum in Sofia mit Galerie, Mietdetails und Anfrage zur Terminverfügbarkeit."
          },
          mikicharli: {
            label: "Reales Projekt",
            title: "Мики и Чарли",
            type: "Website für Kinderanimateure",
            copy: "Website für zwei Clowns und Animateure für Kindergeburtstage in Sofia, mit Programm, Galerie und Anfrageformular."
          },
          bocalculator: {
            label: "Auftragsarbeit",
            title: "Beneficial Ownership Calculator",
            type: "Beteiligungsrechner",
            copy: "Ein Rechner für wirtschaftlich Berechtigte bei mehrstufigen Beteiligungsstrukturen. Ermittelt die effektiven Anteile über die Ebenen."
          },
          him: {
            label: "Private Auftragsarbeit",
            title: "HIM — Mission Control",
            type: "Geschlossene Arbeitsumgebung",
            copy: "Eine Arbeitsanwendung mit eigener Identität und Firebase-Anmeldung. Zugang nur für freigegebene Konten."
          },
          oblast: {
            label: "Private Auftragsarbeit",
            title: "Област · Демо",
            type: "Digitalisierung kommunaler Akten",
            copy: "Eine Auswertung gescannter Verwaltungsdokumente, bei der jede Zahl aus einer geprüften SQL-Abfrage stammt, nicht aus einem Sprachmodell."
          },
          roadguard: {
            label: "Private Auftragsarbeit",
            title: "RoadGuard",
            type: "Verkehrsanalyse",
            copy: "Eine modulare Plattform zur Analyse des Straßenverkehrs. Spezialauftrag; der Code ist privat."
          },
          wealthmatrix: {
            label: "Private Auftragsarbeit",
            title: "Wealth Matrix",
            type: "System zur Vermögensübersicht",
            copy: "Ein geschlossenes System zur Übersicht und Verfolgung privater Vermögenswerte. Auftragsarbeit; der Code ist privat."
          }
        }
      },
      process: {
        kicker: "Prozess",
        title: "Von der Idee zum funktionierenden System.",
        steps: {
          discovery: {
            title: "Gespräch",
            copy: "Wir klären, wie Ihr Unternehmen arbeitet, was fehlt und welches Ziel wirklich erreicht werden soll."
          },
          structure: {
            title: "Struktur und Design",
            copy: "Wir entwickeln eine klare Architektur, Nutzerführung und visuelle Richtung."
          },
          build: {
            title: "Umsetzung",
            copy: "Wir verwandeln das Konzept in ein schnelles, responsives und geordnetes digitales Produkt."
          },
          launch: {
            title: "Start und Entwicklung",
            copy: "Wir starten, beobachten und verbessern auf Basis der realen Nutzung."
          }
        }
      },
      about: {
        kicker: "Über uns",
        title: "Wer wir sind",
        intro: {
          p1:
            "Saitora wurde von Menschen gegründet, die über 15 Jahre praktische Erfahrung mit digitalen Werkzeugen, Computertechnologien und realen Geschäftsprozessen verbinden.",
          p2:
            "Wir arbeiten seit 2009 an digitalen Projekten - mit Fokus auf Lösungen, die nicht nur gut aussehen, sondern Unternehmen stärker präsentieren, Arbeit besser organisieren und Kunden klarer bedienen.",
          p3:
            "Für uns ist ein gutes digitales Produkt nicht nur eine schöne Website. Es braucht eine klare Rolle: präsentieren, organisieren, Anfragen annehmen, verkaufen oder Zeit sparen."
        },
        strengthsAria: "Schwerpunkte",
        founders: {
          nikolay: {
            role: "Operations und digitale Systeme",
            name: "Nikolay Nedelchev",
            p1:
              "Николай Неделчев verbindet Erfahrung in operativer Steuerung, Business-Analyse, Teamkoordination und dem Aufbau besserer Arbeitsprozesse.",
            p2:
              "Seit seinem 14. Lebensjahr entwickelt er praktisches Interesse und Fähigkeiten im Bereich Computertechnologien, digitale Werkzeuge und Lösungen, die für die Menschen, die sie nutzen, klar und zuverlässig funktionieren.",
            p3:
              "Sein beruflicher Weg umfasst Operations Management, Ressourcenplanung, Teamkoordination, Kundenarbeit, Event Operations und Prozessoptimierung in einem dynamischen internationalen Umfeld.",
            p4:
              "Bei Saitora übersetzt Nikolay reale Geschäftsbedürfnisse in klare digitale Lösungen - hochwertige Websites, Anfragesysteme, Kalender, Buchungen, interne Abläufe und besser organisierten Kundenservice.",
            strengths: {
              operations: "Operatives Management",
              analysis: "Business-Analyse",
              process: "Prozessverbesserung",
              client: "Kundenweg und Anfragen",
              teams: "Teams und Planung",
              events: "Events und Koordination"
            }
          },
          tahir: {
            role: "Technologie und Entwicklung",
            name: "Tahir Muevlu",
            p1:
              "Тахир Муевлу ist ein technologieorientierter Entwickler mit langfristigem Interesse an High-End-Technologien, Softwareprodukten und präziser digitaler Entwicklung.",
            p2:
              "Sein Ansatz konzentriert sich auf eine stabile technische Grundlage, klare Logik, gut organisierte Architektur und die Details, die eine gute Idee zu einem zuverlässigen digitalen Produkt machen.",
            p3:
              "Tahir war an der Entwicklung eines spezialisierten digitalen Produkts für Zahnärzte und Zahntechniker mit internationaler Nutzung beteiligt. Diese Erfahrung bringt eine praktische Perspektive dafür, wie Systeme entstehen, die im realen Arbeitsalltag intuitiv, präzise und belastbar sein müssen.",
            p4:
              "Bei Saitora liegt sein Fokus auf moderner Funktionalität, technischer Zuverlässigkeit, Produktstruktur und Lösungen, die sich mit dem Unternehmen weiterentwickeln können.",
            strengths: {
              dev: "Softwareentwicklung",
              architecture: "Produktarchitektur",
              highEnd: "High-End-Technologien",
              logic: "Systemlogik",
              reliability: "Zuverlässige Funktionalität",
              products: "Digitale Produkte"
            }
          }
        }
      },
      why: {
        overline: "praktische Erfahrung seit 2009 · über 15 Jahre Erfahrung",
        title: "Warum Saitora",
        p1:
          "Unsere praktische Erfahrung beginnt im Jahr 2009 und entwickelt sich seit mehr als 15 Jahren weiter - von der Arbeit mit Computertechnologien und digitalen Werkzeugen bis zum Aufbau von Systemen, Prozessen und Produkten für reale Geschäftsanforderungen.",
        p2:
          "Saitora verbindet zwei Perspektiven, die selten an einem Ort zusammenkommen: Verständnis für reale Geschäftsarbeit und starke technische Umsetzung.",
        p3:
          "Wir beginnen nicht mit einer fertigen Vorlage. Zuerst verstehen wir, wie Sie arbeiten, wie Ihre Kunden Entscheidungen treffen und wo Zeit verloren geht. Danach bauen wir eine Website oder ein digitales System mit klarer Rolle: präsentieren, organisieren, Anfragen annehmen, verkaufen oder automatisieren.",
        p4:
          "Wir arbeiten mit Liebe zum Detail, aber ohne unnötige Komplexität. Das Ziel ist ein Produkt, das hochwertig wirkt, zuverlässig funktioniert und lange nach dem Start nützlich bleibt.",
        pillars: {
          business: {
            title: "Zuerst verstehen wir das Unternehmen",
            copy: "Die Lösung beginnt beim Prozess, nicht bei einer fertigen Vorlage."
          },
          function: {
            title: "Design mit klarer Funktion",
            copy: "Jede Sektion, jeder Bildschirm und jede Aktion hat ein konkretes Ziel."
          },
          tech: {
            title: "Technologie, die funktioniert",
            copy: "Eine stabile Grundlage, klare Logik und Raum für Entwicklung."
          },
          premium: {
            title: "Premium ohne unnötige Komplexität",
            copy: "Starke Präsenz, einfache Nutzung und echter Wert."
          }
        }
      },
      contact: {
        location: "Sofia, Bulgarien"
      },
      footer: {
        copy: "Digitale Lösungen für Unternehmen, die klarer arbeiten möchten.",
        contactAria: "Kontaktdaten",
        phoneLabel: "Telefon",
        emailLabel: "E-Mail",
        locationLabel: "Standort",
        privacy: "Datenschutzerklärung",
        terms: "Bedingungen"
      },
      projectIntake: {
        close: "Fenster schließen",
        kicker: "Projektanfrage",
        title: "Definieren wir den richtigen Startpunkt.",
        description:
          "Beantworten Sie einige gezielte Fragen und erstellen Sie eine vorbereitete E-Mail mit einem strukturierten Projektbriefing.",
        progress: "Schritt {current} von 3",
        selected: "Ausgewählt",
        step1: {
          label: "Startpunkt",
          title: "Was möchten Sie zuerst aufbauen?",
          helper:
            "Wählen Sie den passendsten Startpunkt. Wenn Sie noch unsicher sind, ist auch das eine gültige Auswahl.",
          groupAria: "Auswahl der Lösung"
        },
        step2: {
          label: "Prioritäten",
          title: "Was soll verbessert werden?",
          helper: "Wählen Sie bis zu zwei Hauptziele, damit die Anfrage fokussiert bleibt.",
          groupAria: "Auswahl der Prioritäten",
          recommendation: "Empfohlener Startpunkt",
          unsure:
            "Saitora hilft im ersten Gespräch dabei, den richtigen Startpunkt zu bestimmen."
        },
        step3: {
          label: "Kurzes Briefing",
          title: "Teilen Sie das Wesentliche mit.",
          helper:
            "Diese Angaben bleiben in Ihrem Browser, bis Sie die vorbereitete E-Mail öffnen oder die Anfrage kopieren."
        },
        solutions: [
          {
            key: "signature",
            name: "Saitora Signature",
            category: "Premium-Website",
            description: "Eine starke Unternehmenswebsite für Vertrauen, klare Werte und hochwertigen Auftritt."
          },
          {
            key: "capture",
            name: "Saitora Capture",
            category: "Anfragen und CRM",
            description: "Ein geordneter Ablauf für Anfragen, Kunden und nächste Schritte."
          },
          {
            key: "booking",
            name: "Saitora Booking OS",
            category: "Reservierungen, Kalender und Zahlungen",
            description: "Klareres Management von Terminen, Verfügbarkeit, Buchungen und Zahlungen."
          },
          {
            key: "command",
            name: "Saitora Command",
            category: "Internes Operations-System",
            description: "Teams, Aufgaben, Status und interne Abläufe an einem Ort."
          },
          {
            key: "portal",
            name: "Saitora Portal",
            category: "Kundenportal",
            description: "Ein klarer Raum für Projekte, Dokumente, Status und Kommunikation."
          },
          {
            key: "automate",
            name: "Saitora Automate",
            category: "Business-Automatisierungen",
            description: "Weniger manuelle Arbeit durch verbundene Prozesse und automatische Schritte."
          },
          {
            key: "unsure",
            name: "Noch nicht sicher",
            category: "Helfen Sie mir, den richtigen Startpunkt zu wählen",
            description: "Eine gültige Auswahl, wenn zuerst die richtige Richtung geklärt werden soll."
          }
        ],
        priorities: [
          { key: "qualified", label: "Mehr qualifizierte Anfragen gewinnen" },
          { key: "leads", label: "Leads und Kundenkommunikation organisieren" },
          { key: "bookings", label: "Buchungen, Verfügbarkeit und Zahlungen verwalten" },
          { key: "operations", label: "Aufgaben, Teams und Abläufe an einem Ort bündeln" },
          { key: "portal", label: "Kunden einen klareren Projektraum geben" },
          { key: "manual", label: "Wiederholte manuelle Arbeit reduzieren" },
          { key: "presence", label: "Einen stärkeren Premium-Online-Auftritt aufbauen" }
        ],
        form: {
          name: "Name",
          email: "E-Mail",
          business: "Unternehmen / Marke",
          phone: "Telefonnummer",
          context: "Kurzer Projektkontext / was das Unternehmen benötigt",
          timeline: "Bevorzugter Zeitrahmen",
          timelinePlaceholder: "Zeitrahmen wählen",
          timelines: {
            asap: "So bald wie möglich",
            oneTwo: "Innerhalb von 1-2 Monaten",
            three: "Innerhalb von 3 Monaten",
            exploring: "Ich prüfe Optionen"
          },
          consent:
            "Ich stimme zu, dass Saitora die angegebenen Informationen verwenden darf, um auf meine Anfrage zu antworten."
        },
        actions: {
          back: "Zurück",
          next: "Weiter",
          openEmail: "Vorbereitete E-Mail öffnen",
          copy: "Anfrage kopieren",
          draftNote:
            "Der letzte Schritt öffnet einen vorbereiteten E-Mail-Entwurf in Ihrem Mail-Programm. Es wird nichts automatisch gesendet.",
          copied: "Anfrage kopiert",
          copyFailed:
            "Das Kopieren war nicht erfolgreich. Sie können den Text manuell markieren und kopieren."
        },
        errors: {
          solution: "Bitte wählen Sie einen Startpunkt.",
          maxPriorities: "Sie können bis zu zwei Prioritäten auswählen.",
          required: "Dieses Feld ist erforderlich.",
          email: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
          consent: "Bitte bestätigen Sie die Zustimmung, bevor Sie fortfahren."
        },
        email: {
          subject: "Neue Saitora Projektanfrage"
        },
        summary: {
          title: "Saitora Projektanfrage",
          startingPoint: "Ausgewählter Startpunkt",
          priorities: "Hauptprioritäten",
          noPriorities: "Keine Prioritäten ausgewählt",
          contact: "Kontakt und Unternehmen",
          name: "Name",
          email: "E-Mail",
          business: "Unternehmen / Marke",
          phone: "Telefon",
          timeline: "Bevorzugter Zeitrahmen",
          context: "Kurzer Projektkontext",
          notProvided: "Nicht angegeben"
        }
      },
      modal: {
        close: "Fenster schließen",
        projects: {
          partizala: {
            label: "Reales Projekt",
            title: "Partizala",
            description:
              "Eine digitale Lösung für einen Partyraum mit öffentlichen Informationen, Buchungs- und Besichtigungsanfragen, Kalender mit belegten Zeiträumen und einem geordneteren Prozess zur Verwaltung von Anfragen.",
            featuresTitle: "Enthaltene Funktionalität",
            features: [
              "Hochwertige Präsentation der Leistung",
              "Buchungsformular",
              "Formular für Besichtigungsanfragen",
              "Kalender mit belegten Zeiträumen",
              "Klarer Prozess für eingehende Anfragen",
              "Mobile-first-Struktur"
            ]
          },
          professional: {
            label: "Konzeptprojekt",
            title: "Professionelle Dienstleistungen",
            description:
              "Ein Konzept für ein Unternehmen, das Expertise, Leistungen und Prozess ohne unnötigen Lärm erklären muss. Der Fokus liegt auf Vertrauen, klaren Anfragen und praktischer Struktur.",
            featuresTitle: "Mögliche Komponenten",
            features: [
              "Unternehmenspräsentation",
              "Strukturierte Leistungen",
              "Formular für qualifizierte Anfragen",
              "Sektion für Prozess und Ansatz",
              "SEO-Grundlage für Leistungen",
              "Klare Richtung für künftige Entwicklung"
            ]
          },
          hospitality: {
            label: "Konzeptprojekt",
            title: "Gastgewerbe und Buchungen",
            description:
              "Ein Konzept für ein Restaurant, Hotel oder eine Location, die Präsentation, Eventanfragen, Buchungen und klareres Verfügbarkeitsmanagement benötigt.",
            featuresTitle: "Mögliche Komponenten",
            features: [
              "Präsentation von Raum oder Leistung",
              "Formulare für Reservierungen und Events",
              "Verfügbarkeit oder Kalender",
              "Kontakt und Standort",
              "Menü oder Paketangebote",
              "Geordnetes mobiles Erlebnis"
            ]
          }
        },
        legal: {
          privacy: {
            label: "Informationstext",
            title: "Datenschutzerklärung",
            description:
              "Dies ist ein vorläufiger Informationstext für eine statische Website. Das Kontaktformular sendet keine E-Mail und speichert keine Anfrage in einer Datenbank. Vor öffentlicher Nutzung sollte der Inhalt an die tatsächliche Verarbeitung personenbezogener Daten angepasst werden.",
            featuresTitle: "",
            features: []
          },
          terms: {
            label: "Informationstext",
            title: "Bedingungen",
            description:
              "Dies ist ein vorläufiger Text für künftige Bedingungen. Er enthält keine rechtlichen Aussagen, Garantien, Preise, Fristen oder Vertragsklauseln. Reale Bedingungen sollten entsprechend den konkreten Leistungen und dem Arbeitsprozess vorbereitet werden.",
            featuresTitle: "",
            features: []
          }
        }
      }
    }
  };

  let currentLanguage = getStoredLanguage();
  let lastFocusedElement = null;
  let intakeLastFocusedElement = null;
  let activeModalContent = null;
  let activeNavigationFrame = null;
  let navigationSections = [];
  const intakeState = {
    step: 1,
    solution: "",
    priorities: []
  };

  function getSearchParams() {
    try {
      return new URLSearchParams(window.location.search);
    } catch (error) {
      return null;
    }
  }

  function getUrlLanguage() {
    const params = getSearchParams();
    const language = params ? params.get("lang") : "";
    return supportedLanguages.includes(language) ? language : "";
  }

  function getStoredLanguage() {
    const urlLanguage = getUrlLanguage();
    if (urlLanguage) {
      try {
        window.localStorage.setItem(storageKey, urlLanguage);
      } catch (error) {
        return urlLanguage;
      }

      return urlLanguage;
    }

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

    if (value === undefined && language !== "bg") {
      return getValue(path, "bg");
    }

    return value;
  }

  function setMetaContent(selector, value) {
    const element = document.querySelector(selector);
    if (element && value) element.setAttribute("content", value);
  }

  function updateNavToggleLabel() {
    if (!navToggle) return;
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-label", getValue(isOpen ? "nav.closeMenu" : "nav.openMenu"));
  }

  function updateDemoLinks() {
    solutionDemoLinks.forEach((link) => {
      const route = demoRoutes[link.dataset.demoLink];
      if (!route) return;
      link.setAttribute("href", `${route}?lang=${encodeURIComponent(currentLanguage)}`);
    });
  }

  function applyTranslations(language) {
    currentLanguage = supportedLanguages.includes(language) ? language : "bg";
    const meta = getValue("meta");

    document.documentElement.lang = currentLanguage;
    document.title = meta.title;
    setMetaContent("meta[name='description']", meta.description);
    setMetaContent("meta[property='og:title']", meta.title);
    setMetaContent("meta[property='og:description']", meta.description);
    setMetaContent("meta[property='og:locale']", meta.ogLocale);

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const value = getValue(element.dataset.i18n);
      if (typeof value === "string") element.textContent = value;
    });

    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      const value = getValue(element.dataset.i18nAriaLabel);
      if (typeof value === "string") element.setAttribute("aria-label", value);
    });

    languageButtons.forEach((button) => {
      const isActive = button.dataset.langOption === currentLanguage;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
      if (isActive) {
        button.setAttribute("aria-current", "true");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    updateNavToggleLabel();
    updateDemoLinks();

    if (activeModalContent && modal && modal.classList.contains("is-open")) {
      renderModalContent(getModalContent(activeModalContent.type, activeModalContent.key));
    }

    renderProjectIntake();
  }

  function setLanguage(language) {
    if (!supportedLanguages.includes(language)) return;
    applyTranslations(language);
    storeLanguage(language);
    requestActiveNavigationUpdate();
  }

  function setHeaderState() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }

  function closeNavigation() {
    if (!navToggle || !navMenu) return;
    navToggle.setAttribute("aria-expanded", "false");
    navMenu.classList.remove("is-open");
    body.classList.remove("nav-open");
    updateNavToggleLabel();
  }

  function toggleNavigation() {
    if (!navToggle || !navMenu) return;

    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    navMenu.classList.toggle("is-open", !isOpen);
    body.classList.toggle("nav-open", !isOpen);
    updateNavToggleLabel();
  }

  function getIntakeSolutions() {
    const solutions = getValue("projectIntake.solutions");
    return Array.isArray(solutions) ? solutions : [];
  }

  function getIntakePriorities() {
    const priorities = getValue("projectIntake.priorities");
    return Array.isArray(priorities) ? priorities : [];
  }

  function findIntakeSolution(key) {
    return getIntakeSolutions().find((solution) => solution.key === key) || null;
  }

  function normalizeIntakeSolutionKey(key) {
    if (!key) return "";
    const normalizedKey = intakeSolutionAliases[key] || key;
    return findIntakeSolution(normalizedKey) ? normalizedKey : "";
  }

  function findIntakePriority(key) {
    return getIntakePriorities().find((priority) => priority.key === key) || null;
  }

  function setIntakeError(key, message = "") {
    if (!intakeErrors[key]) return;
    intakeErrors[key].textContent = message;
  }

  function setIntakeFieldError(key, message = "") {
    setIntakeError(key, message);
    const field = intakeFields[key];
    if (!field) return;

    if (message) {
      field.setAttribute("aria-invalid", "true");
    } else {
      field.removeAttribute("aria-invalid");
    }
  }

  function clearIntakeErrors() {
    Object.keys(intakeErrors).forEach((key) => setIntakeError(key));
    Object.keys(intakeFields).forEach((key) => {
      if (intakeFields[key]) intakeFields[key].removeAttribute("aria-invalid");
    });
  }

  function getIntakeFieldValue(key) {
    const field = intakeFields[key];
    if (!field) return "";
    if (field.type === "checkbox") return field.checked ? "yes" : "";
    return field.value.trim();
  }

  function getIntakeTimelineLabel() {
    const field = intakeFields.timeline;
    if (!field || !field.value) return "";
    const selectedOption = field.selectedOptions && field.selectedOptions[0];
    return selectedOption ? selectedOption.textContent.trim() : field.value;
  }

  function createIntakeOptionCard(item, type, selected) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "intake-option-card";
    button.dataset.intakeOptionKey = item.key;
    button.setAttribute("role", type === "solution" ? "radio" : "checkbox");
    button.setAttribute("aria-checked", String(selected));
    if (selected) button.classList.add("is-selected");

    const check = document.createElement("span");
    check.className = "intake-option-check";
    check.setAttribute("aria-hidden", "true");

    const title = document.createElement("strong");
    title.textContent = item.name || item.label;

    button.append(check, title);

    if (item.category) {
      const category = document.createElement("em");
      category.textContent = item.category;
      button.append(category);
    }

    if (item.description) {
      const description = document.createElement("p");
      description.textContent = item.description;
      button.append(description);
    }

    if (type === "solution") {
      button.addEventListener("click", () => selectIntakeSolution(item.key));
    } else {
      button.addEventListener("click", () => toggleIntakePriority(item.key));
    }

    return button;
  }

  function renderIntakeSolutions() {
    if (!intakeSolutions) return;
    intakeSolutions.innerHTML = "";
    getIntakeSolutions().forEach((solution) => {
      intakeSolutions.append(createIntakeOptionCard(solution, "solution", intakeState.solution === solution.key));
    });
  }

  function renderIntakePriorities() {
    if (!intakePriorities) return;
    intakePriorities.innerHTML = "";
    getIntakePriorities().forEach((priority) => {
      intakePriorities.append(
        createIntakeOptionCard(priority, "priority", intakeState.priorities.includes(priority.key))
      );
    });
  }

  function renderIntakeRecommendation() {
    if (!intakeRecommendation) return;

    intakeRecommendation.innerHTML = "";
    const label = document.createElement("span");
    label.textContent = getValue("projectIntake.step2.recommendation");
    intakeRecommendation.append(label);

    const selectedSolution = findIntakeSolution(intakeState.solution);
    if (!selectedSolution || selectedSolution.key === "unsure") {
      const copy = document.createElement("p");
      copy.textContent = getValue("projectIntake.step2.unsure");
      intakeRecommendation.append(copy);
      return;
    }

    const title = document.createElement("strong");
    title.textContent = selectedSolution.name;
    const copy = document.createElement("p");
    copy.textContent = selectedSolution.category;
    intakeRecommendation.append(title, copy);
  }

  function updateIntakeProgress() {
    if (intakeProgressText) {
      intakeProgressText.textContent = getValue("projectIntake.progress").replace(
        "{current}",
        String(intakeState.step)
      );
    }

    intakeProgressDots.forEach((dot) => {
      const step = Number(dot.dataset.intakeProgressDot);
      dot.classList.toggle("is-active", step <= intakeState.step);
    });
  }

  function updateIntakeActions() {
    if (intakeBackButton) intakeBackButton.hidden = intakeState.step === 1;
    if (intakeCopyButton) intakeCopyButton.hidden = intakeState.step !== 3;
    if (intakeDraftNote) intakeDraftNote.hidden = intakeState.step !== 3;

    if (intakeNextButton) {
      intakeNextButton.textContent =
        intakeState.step === 3 ? getValue("projectIntake.actions.openEmail") : getValue("projectIntake.actions.next");
    }
  }

  function renderProjectIntake() {
    if (!projectIntake) return;

    intakeSteps.forEach((step) => {
      step.hidden = Number(step.dataset.intakeStep) !== intakeState.step;
    });

    renderIntakeSolutions();
    renderIntakePriorities();
    renderIntakeRecommendation();
    updateIntakeProgress();
    updateIntakeActions();
  }

  function setIntakeStep(step) {
    intakeState.step = Math.min(3, Math.max(1, step));
    if (intakeStatus) intakeStatus.textContent = "";
    setIntakeError("priorities");
    renderProjectIntake();

    if (projectIntakePanel && projectIntake.classList.contains("is-open")) {
      projectIntakePanel.focus({ preventScroll: true });
    }
  }

  function selectIntakeSolution(key) {
    intakeState.solution = key;
    setIntakeError("solution");
    renderProjectIntake();
  }

  function toggleIntakePriority(key) {
    const selectedIndex = intakeState.priorities.indexOf(key);

    if (selectedIndex >= 0) {
      intakeState.priorities.splice(selectedIndex, 1);
      setIntakeError("priorities");
      renderProjectIntake();
      return;
    }

    if (intakeState.priorities.length >= 2) {
      setIntakeError("priorities", getValue("projectIntake.errors.maxPriorities"));
      return;
    }

    intakeState.priorities.push(key);
    setIntakeError("priorities");
    renderProjectIntake();
  }

  function validateIntakeStep(step) {
    if (step === 1 && !intakeState.solution) {
      setIntakeError("solution", getValue("projectIntake.errors.solution"));
      const firstOption = intakeSolutions ? intakeSolutions.querySelector("button") : null;
      if (firstOption) firstOption.focus();
      return false;
    }

    if (step !== 3) return true;

    let firstInvalid = null;
    const requiredError = getValue("projectIntake.errors.required");

    ["name", "email", "context", "timeline"].forEach((key) => {
      const value = key === "timeline" ? getIntakeFieldValue(key) : getIntakeFieldValue(key).trim();
      const message = value ? "" : requiredError;
      setIntakeFieldError(key, message);
      if (message && !firstInvalid) firstInvalid = intakeFields[key];
    });

    if (getIntakeFieldValue("email")) {
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(getIntakeFieldValue("email"));
      setIntakeFieldError("email", isValidEmail ? "" : getValue("projectIntake.errors.email"));
      if (!isValidEmail && !firstInvalid) firstInvalid = intakeFields.email;
    }

    if (!intakeFields.consent || !intakeFields.consent.checked) {
      setIntakeFieldError("consent", getValue("projectIntake.errors.consent"));
      if (!firstInvalid) firstInvalid = intakeFields.consent;
    } else {
      setIntakeFieldError("consent");
    }

    if (firstInvalid && typeof firstInvalid.focus === "function") {
      firstInvalid.focus();
      return false;
    }

    return true;
  }

  function getProjectBriefSummary() {
    const labels = getValue("projectIntake.summary");
    const selectedSolution = findIntakeSolution(intakeState.solution);
    const selectedPriorities = intakeState.priorities
      .map((key) => findIntakePriority(key))
      .filter(Boolean)
      .map((priority) => `- ${priority.label}`);

    const startingPoint = selectedSolution
      ? `${selectedSolution.name} - ${selectedSolution.category}`
      : labels.notProvided;

    return [
      labels.title,
      "",
      `${labels.startingPoint}:`,
      startingPoint,
      "",
      `${labels.priorities}:`,
      selectedPriorities.length ? selectedPriorities.join("\n") : labels.noPriorities,
      "",
      `${labels.contact}:`,
      `${labels.name}: ${getIntakeFieldValue("name") || labels.notProvided}`,
      `${labels.email}: ${getIntakeFieldValue("email") || labels.notProvided}`,
      `${labels.business}: ${getIntakeFieldValue("business") || labels.notProvided}`,
      `${labels.phone}: ${getIntakeFieldValue("phone") || labels.notProvided}`,
      `${labels.timeline}: ${getIntakeTimelineLabel() || labels.notProvided}`,
      "",
      `${labels.context}:`,
      getIntakeFieldValue("context") || labels.notProvided
    ].join("\n");
  }

  function openPreparedProjectEmail() {
    if (!validateIntakeStep(3)) return;

    const subject = getValue("projectIntake.email.subject");
    const bodyText = getProjectBriefSummary();
    const mailto = `mailto:nikolay@nedelchevweb.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      bodyText
    )}`;
    const link = document.createElement("a");

    link.href = mailto;
    link.hidden = true;
    body.append(link);
    link.click();
    link.remove();
  }

  function fallbackCopyText(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-999px";
    textarea.style.left = "-999px";
    body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }

  async function copyProjectBrief() {
    if (!validateIntakeStep(3)) return;

    const summary = getProjectBriefSummary();
    let copied = false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(summary);
        copied = true;
      }
    } catch (error) {
      copied = false;
    }

    if (!copied) {
      copied = fallbackCopyText(summary);
    }

    if (copied) {
      if (intakeStatus) intakeStatus.textContent = getValue("projectIntake.actions.copied");
    } else {
      if (intakeStatus) intakeStatus.textContent = getValue("projectIntake.actions.copyFailed");
    }
  }

  function resetProjectIntake() {
    intakeState.step = 1;
    intakeState.solution = "";
    intakeState.priorities = [];
    if (intakeForm) intakeForm.reset();
    if (intakeStatus) intakeStatus.textContent = "";
    clearIntakeErrors();
    renderProjectIntake();
  }

  function openProjectIntake(event, preselectedSolution = "") {
    if (!projectIntake) return;
    if (event) event.preventDefault();

    intakeLastFocusedElement = document.activeElement;
    closeNavigation();
    closeModal();
    resetProjectIntake();

    const normalizedSolution = normalizeIntakeSolutionKey(preselectedSolution);
    if (normalizedSolution) {
      intakeState.solution = normalizedSolution;
      renderProjectIntake();
    }

    projectIntake.classList.add("is-open");
    projectIntake.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");

    window.requestAnimationFrame(() => {
      if (projectIntakePanel) projectIntakePanel.focus();
    });
  }

  function initProjectIntakeFromUrl() {
    const params = getSearchParams();
    if (!params || params.get("intake") !== "1") return;

    openProjectIntake(null, params.get("solution") || "");
  }

  function closeProjectIntake() {
    if (!projectIntake || !projectIntake.classList.contains("is-open")) return;

    projectIntake.classList.remove("is-open");
    projectIntake.setAttribute("aria-hidden", "true");
    if (!modal || !modal.classList.contains("is-open")) body.classList.remove("modal-open");

    if (intakeLastFocusedElement && typeof intakeLastFocusedElement.focus === "function") {
      intakeLastFocusedElement.focus();
    }
  }

  function trapProjectIntakeFocus(event) {
    if (!projectIntake || !projectIntake.classList.contains("is-open") || event.key !== "Tab") return;

    const focusable = projectIntake.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function getModalContent(type, key) {
    if (type === "project") {
      const content = getValue(`modal.projects.${key}`);
      return content
        ? Object.assign({}, content, {
            visual: projectVisuals[key] || "",
            links: projectLinks[key] || null
          })
        : null;
    }

    if (type === "legal") {
      const content = getValue(`modal.legal.${key}`);
      return content ? Object.assign({}, content, { visual: "" }) : null;
    }

    return null;
  }

  function renderFeatures(content) {
    if (!modalFeatures) return;

    if (!content.features || !content.features.length) {
      modalFeatures.hidden = true;
      modalFeatures.innerHTML = "";
      return;
    }

    const items = content.features.map((feature) => `<li>${feature}</li>`).join("");
    modalFeatures.hidden = false;
    modalFeatures.innerHTML = `<h3>${content.featuresTitle}</h3><ul>${items}</ul>`;
  }

  function renderModalLinks(content) {
    if (!modalFeatures) return;
    const old = modal.querySelector(".modal-links");
    if (old) old.remove();
    if (!content.links) return;

    const parts = [];
    if (content.links.demo) {
      parts.push(`<a href="${content.links.demo}" target="_blank" rel="noopener">${getValue("projects.demo")}</a>`);
    }
    if (content.links.live) {
      parts.push(`<a href="${content.links.live}" target="_blank" rel="noopener">${getValue("projects.live")}</a>`);
    }
    if (!parts.length) return;

    const wrap = document.createElement("div");
    wrap.className = "modal-links";
    wrap.innerHTML = parts.join("");
    modalFeatures.insertAdjacentElement("afterend", wrap);
  }

  function renderModalContent(content) {
    if (!modal || !content) return;

    modalLabel.textContent = content.label;
    modalTitle.textContent = content.title;
    modalDescription.textContent = content.description;
    modalVisual.innerHTML = content.visual || "";
    modalVisual.hidden = !content.visual;
    renderFeatures(content);
    renderModalLinks(content);
  }

  function openModal(type, key) {
    const content = getModalContent(type, key);
    if (!modal || !content) return;

    activeModalContent = { type, key };
    lastFocusedElement = document.activeElement;
    renderModalContent(content);

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");
    modalCloseButton.focus();
  }

  function closeModal() {
    if (!modal || !modal.classList.contains("is-open")) return;

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    body.classList.remove("modal-open");
    modalVisual.innerHTML = "";
    modalFeatures.innerHTML = "";
    modalFeatures.hidden = true;
    activeModalContent = null;

    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
  }

  function trapModalFocus(event) {
    if (!modal || !modal.classList.contains("is-open") || event.key !== "Tab") return;

    const focusable = modal.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function initReveals() {
    const revealItems = document.querySelectorAll(".reveal-section, .reveal-item");
    let revealFrame = null;

    const revealVisibleItems = () => {
      revealItems.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight * 0.94 && rect.bottom > 0;
        if (isVisible) item.classList.add("is-visible");
      });
    };

    const requestRevealCheck = () => {
      if (revealFrame) return;
      revealFrame = window.requestAnimationFrame(() => {
        revealFrame = null;
        revealVisibleItems();
      });
    };

    if (!("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.04, rootMargin: "0px 0px -4% 0px" }
    );

    revealItems.forEach((item) => observer.observe(item));
    window.addEventListener("scroll", requestRevealCheck, { passive: true });
    window.addEventListener("resize", requestRevealCheck);
    window.requestAnimationFrame(revealVisibleItems);
    window.setTimeout(revealVisibleItems, 180);
  }

  function initActiveNavigation() {
    if (!navLinks.length) return;

    navigationSections = navLinks
      .map((link) => {
        const section = document.querySelector(link.getAttribute("href"));
        return section ? { link, section } : null;
      })
      .filter(Boolean);

    if (!navigationSections.length) return;

    window.addEventListener("scroll", requestActiveNavigationUpdate, { passive: true });
    window.addEventListener("resize", requestActiveNavigationUpdate);
    updateActiveNavigation();
  }

  function setActiveNavigation(id) {
    navLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function updateActiveNavigation() {
    if (!navigationSections.length) {
      activeNavigationFrame = null;
      return;
    }

    const headerHeight = header ? header.offsetHeight : 0;
    const checkpoint = headerHeight + window.innerHeight * 0.28;
    let current = navigationSections[0];
    let hasVisibleSection = false;

    navigationSections.forEach((item) => {
      const rect = item.section.getBoundingClientRect();
      const intersectsViewport = rect.bottom > headerHeight && rect.top < window.innerHeight;
      if (!intersectsViewport) return;

      hasVisibleSection = true;
      if (rect.top <= checkpoint) current = item;
    });

    setActiveNavigation((hasVisibleSection ? current : navigationSections[0]).section.id);
    activeNavigationFrame = null;
  }

  function requestActiveNavigationUpdate() {
    if (activeNavigationFrame) return;
    activeNavigationFrame = window.requestAnimationFrame(updateActiveNavigation);
  }

  function setActiveSolution(key, focusTab = false) {
    if (!key || !solutionTabs.length || !solutionPanels.length) return;

    solutionTabs.forEach((tab) => {
      const isActive = tab.dataset.solutionTab === key;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.setAttribute("tabindex", isActive ? "0" : "-1");
      if (isActive) {
        tab.scrollIntoView({ block: "nearest", inline: "nearest" });
        if (focusTab) tab.focus();
      }
    });

    solutionPanels.forEach((panel) => {
      const isActive = panel.dataset.solutionPanel === key;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });
  }

  function initSolutionSwitcher() {
    if (!solutionTabs.length || !solutionPanels.length) return;

    const activeTab = solutionTabs.find((tab) => tab.classList.contains("is-active")) || solutionTabs[0];
    setActiveSolution(activeTab.dataset.solutionTab);

    solutionTabs.forEach((tab, index) => {
      tab.addEventListener("click", () => setActiveSolution(tab.dataset.solutionTab));
      tab.addEventListener("keydown", (event) => {
        const keyActions = {
          ArrowRight: () => (index + 1) % solutionTabs.length,
          ArrowDown: () => (index + 1) % solutionTabs.length,
          ArrowLeft: () => (index - 1 + solutionTabs.length) % solutionTabs.length,
          ArrowUp: () => (index - 1 + solutionTabs.length) % solutionTabs.length,
          Home: () => 0,
          End: () => solutionTabs.length - 1
        };

        if (!keyActions[event.key]) return;
        event.preventDefault();
        const nextTab = solutionTabs[keyActions[event.key]()];
        setActiveSolution(nextTab.dataset.solutionTab, true);
      });
    });
  }

  if (currentYear) {
    currentYear.textContent = String(new Date().getFullYear());
  }

  languageButtons.forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.langOption));
  });

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", toggleNavigation);
    navMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeNavigation);
    });
  }

  projectIntakeOpeners.forEach((opener) => {
    opener.addEventListener("click", (event) => openProjectIntake(event, opener.dataset.intakeSolution || ""));
  });

  projectIntakeCloseButtons.forEach((button) => {
    button.addEventListener("click", closeProjectIntake);
  });

  if (intakeForm) {
    intakeForm.addEventListener("submit", (event) => event.preventDefault());
  }

  if (intakeBackButton) {
    intakeBackButton.addEventListener("click", () => setIntakeStep(intakeState.step - 1));
  }

  if (intakeNextButton) {
    intakeNextButton.addEventListener("click", () => {
      if (intakeState.step === 3) {
        openPreparedProjectEmail();
        return;
      }

      if (validateIntakeStep(intakeState.step)) {
        setIntakeStep(intakeState.step + 1);
      }
    });
  }

  if (intakeCopyButton) {
    intakeCopyButton.addEventListener("click", copyProjectBrief);
  }

  Object.keys(intakeFields).forEach((key) => {
    const eventName = intakeFields[key].type === "checkbox" || intakeFields[key].tagName === "SELECT" ? "change" : "input";
    intakeFields[key].addEventListener(eventName, () => {
      setIntakeFieldError(key);
      if (intakeStatus) intakeStatus.textContent = "";
    });
  });

  document.querySelectorAll("[data-project]").forEach((button) => {
    button.addEventListener("click", () => openModal("project", button.dataset.project));
  });

  document.querySelectorAll("[data-legal]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openModal("legal", link.dataset.legal);
    });
  });

  modalCloseButtons.forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNavigation();
      closeModal();
      closeProjectIntake();
    }

    trapModalFocus(event);
    trapProjectIntakeFocus(event);
  });

  window.addEventListener("scroll", setHeaderState, { passive: true });
  setHeaderState();
  applyTranslations(currentLanguage);
  initSolutionSwitcher();
  initReveals();
  initActiveNavigation();
  initProjectIntakeFromUrl();
})();
