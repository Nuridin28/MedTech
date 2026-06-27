import type { Lang } from './i18n'

/**
 * UI translations. Key = English source string; values for ru/kk.
 * (English renders the key itself, so missing entries fall back to English.)
 * Real data (clinic/service names, prices) is NOT translated — it comes from the
 * backend as-is.
 */
export const DICT: Record<string, Partial<Record<Lang, string>>> = {
  // --- Nav / shell ---
  Clinics: { ru: 'Клиники', kk: 'Клиникалар' },
  Map: { ru: 'Карта', kk: 'Карта' },
  Dashboard: { ru: 'Кабинет', kk: 'Кабинет' },
  Appointments: { ru: 'Записи', kk: 'Жазылулар' },
  Saved: { ru: 'Избранное', kk: 'Таңдаулы' },
  'Sign In': { ru: 'Войти', kk: 'Кіру' },
  'Medical records': { ru: 'Мед. записи', kk: 'Медициналық жазбалар' },
  Services: { ru: 'Услуги', kk: 'Қызметтер' },
  Admin: { ru: 'Админка', kk: 'Әкімші' },

  // --- Footer ---
  Platform: { ru: 'Платформа', kk: 'Платформа' },
  Account: { ru: 'Аккаунт', kk: 'Аккаунт' },
  'Follow Us': { ru: 'Мы в соцсетях', kk: 'Әлеуметтік желілерде' },
  'Find prices': { ru: 'Найти цены', kk: 'Бағаларды табу' },
  'For Clinics': { ru: 'Для клиник', kk: 'Клиникаларға' },
  'Saved clinics': { ru: 'Сохранённые клиники', kk: 'Сақталған клиникалар' },

  // --- Home ---
  'Compare medical prices in seconds': {
    ru: 'Сравнивайте цены на медуслуги за секунды',
    kk: 'Медициналық қызмет бағасын секундта салыстырыңыз',
  },
  'Find the best deals for MRI, blood tests, and doctor consultations across Kazakhstan. Transparent pricing from 500+ verified clinics.':
    {
      ru: 'Найдите лучшие цены на МРТ, анализы и приёмы врачей по всему Казахстану. Прозрачные цены от 500+ проверенных клиник.',
      kk: 'Қазақстан бойынша МРТ, талдаулар мен дәрігер қабылдауының ең тиімді бағасын табыңыз. 500+ тексерілген клиниканың ашық бағасы.',
    },
  'MRI of the brain, General blood test...': {
    ru: 'МРТ головного мозга, общий анализ крови...',
    kk: 'Ми МРТ-сы, қанның жалпы талдауы...',
  },
  'Find Best Price': { ru: 'Найти лучшую цену', kk: 'Ең жақсы бағаны табу' },
  '500+ Verified Clinics': { ru: '500+ проверенных клиник', kk: '500+ тексерілген клиника' },
  'Prices Updated Daily': { ru: 'Цены обновляются ежедневно', kk: 'Бағалар күн сайын жаңарады' },
  'Secure Booking': { ru: 'Безопасная запись', kk: 'Қауіпсіз жазылу' },
  'Popular Services': { ru: 'Популярные услуги', kk: 'Танымал қызметтер' },
  'Most requested diagnostic and analytical procedures': {
    ru: 'Самые востребованные диагностические и лабораторные процедуры',
    kk: 'Ең сұранысқа ие диагностикалық және зертханалық рәсімдер',
  },
  'View all services': { ru: 'Все услуги', kk: 'Барлық қызметтер' },
  'Compare Prices': { ru: 'Сравнить цены', kk: 'Бағаларды салыстыру' },
  'Clinics in major cities': { ru: 'Клиники в крупных городах', kk: 'Ірі қалалардағы клиникалар' },
  'The "Aviasales" of Medical Care': {
    ru: '«Aviasales» в медицине',
    kk: 'Медицинадағы «Aviasales»',
  },
  '1. Search': { ru: '1. Поиск', kk: '1. Іздеу' },
  '2. Compare': { ru: '2. Сравнение', kk: '2. Салыстыру' },
  '3. Choose & Book': { ru: '3. Выбор и запись', kk: '3. Таңдау және жазылу' },

  // --- Search results ---
  Filters: { ru: 'Фильтры', kk: 'Сүзгілер' },
  City: { ru: 'Город', kk: 'Қала' },
  'All cities': { ru: 'Все города', kk: 'Барлық қалалар' },
  'Price range': { ru: 'Диапазон цен', kk: 'Баға аралығы' },
  'Sort by': { ru: 'Сортировка', kk: 'Сұрыптау' },
  'Price: low to high': { ru: 'Цена: по возрастанию', kk: 'Баға: өсу бойынша' },
  'Price: high to low': { ru: 'Цена: по убыванию', kk: 'Баға: кему бойынша' },
  'Recently updated': { ru: 'Недавно обновлённые', kk: 'Жуырда жаңартылған' },
  'Highest rated': { ru: 'С высоким рейтингом', kk: 'Жоғары рейтингті' },
  '{n} offers found': { ru: 'Найдено предложений: {n}', kk: '{n} ұсыныс табылды' },
  Lowest: { ru: 'Минимум', kk: 'Ең төмен' },
  Average: { ru: 'Средняя', kk: 'Орташа' },
  Highest: { ru: 'Максимум', kk: 'Ең жоғары' },
  'Best price': { ru: 'Лучшая цена', kk: 'Ең жақсы баға' },
  Book: { ru: 'Записаться', kk: 'Жазылу' },
  Source: { ru: 'Источник', kk: 'Дереккөз' },
  'No offers found': { ru: 'Предложения не найдены', kk: 'Ұсыныстар табылмады' },
  'Load more': { ru: 'Показать ещё', kk: 'Тағы көрсету' },
  'Back to search': { ru: 'Назад к поиску', kk: 'Іздеуге оралу' },

  // --- Clinic ---
  Verified: { ru: 'Проверено', kk: 'Тексерілген' },
  'Save clinic': { ru: 'Сохранить клинику', kk: 'Клиниканы сақтау' },
  'Visit source': { ru: 'Открыть источник', kk: 'Дереккөзді ашу' },
  'Services & Prices': { ru: 'Услуги и цены', kk: 'Қызметтер мен бағалар' },
  'Ratings & Reviews': { ru: 'Рейтинг и отзывы', kk: 'Рейтинг пен пікірлер' },
  'Search service': { ru: 'Поиск услуги', kk: 'Қызметті іздеу' },

  // --- Common / states ---
  Loading: { ru: 'Загрузка', kk: 'Жүктелуде' },
  'Not rated': { ru: 'Без оценки', kk: 'Бағаланбаған' },
  'Updated today': { ru: 'Обновлено сегодня', kk: 'Бүгін жаңартылды' },
  'Updated yesterday': { ru: 'Обновлено вчера', kk: 'Кеше жаңартылды' },
  // categories
  Laboratory: { ru: 'Лаборатория', kk: 'Зертхана' },
  Diagnostics: { ru: 'Диагностика', kk: 'Диагностика' },
  Specialists: { ru: 'Специалисты', kk: 'Мамандар' },
  Procedures: { ru: 'Процедуры', kk: 'Рәсімдер' },
  // account
  'No appointments yet': { ru: 'Пока нет записей', kk: 'Әзірге жазылулар жоқ' },
  'No saved clinics yet': { ru: 'Пока нет сохранённых клиник', kk: 'Әзірге сақталған клиникалар жоқ' },
  'No records yet': { ru: 'Пока нет записей', kk: 'Әзірге жазбалар жоқ' },
  Upcoming: { ru: 'Предстоящие', kk: 'Алдағы' },
  Completed: { ru: 'Завершённые', kk: 'Аяқталған' },
  Cancelled: { ru: 'Отменённые', kk: 'Бас тартылған' },
  Cancel: { ru: 'Отменить', kk: 'Болдырмау' },

  // --- Home (extended) ---
  'Search medical services': { ru: 'Поиск медуслуг', kk: 'Медқызметтерді іздеу' },
  'Select city': { ru: 'Выберите город', kk: 'Қаланы таңдаңыз' },
  'Searching…': { ru: 'Идёт поиск…', kk: 'Ізделуде…' },
  'No services found for': { ru: 'Ничего не найдено по запросу', kk: 'Сұраныс бойынша табылмады' },
  Diagnostic: { ru: 'Диагностика', kk: 'Диагностика' },
  'MRI & CT Scans': { ru: 'МРТ и КТ', kk: 'МРТ және КТ' },
  'Blood Tests': { ru: 'Анализы крови', kk: 'Қан талдаулары' },
  Dentistry: { ru: 'Стоматология', kk: 'Стоматология' },
  Ultrasound: { ru: 'УЗИ', kk: 'УДЗ' },
  "We don't provide medical services. We provide transparency. Search, compare, and book the most affordable clinics in three easy steps.":
    {
      ru: 'Мы не оказываем медуслуги. Мы даём прозрачность. Ищите, сравнивайте и записывайтесь в самые доступные клиники в три простых шага.',
      kk: 'Біз медқызмет көрсетпейміз — біз ашықтық береміз. Іздеңіз, салыстырыңыз және ең қолжетімді клиникаға үш қадаммен жазылыңыз.',
    },
  'Enter any medical procedure or laboratory test. Our database covers everything from general checkups to complex surgeries.':
    {
      ru: 'Введите любую процедуру или анализ. Наша база охватывает всё — от чек-апов до сложных операций.',
      kk: 'Кез келген рәсімді немесе талдауды енгізіңіз. Біздің база чек-аптан күрделі операцияларға дейін қамтиды.',
    },
  'Sort results by price, clinic rating, or distance from your home. See real photos and verified patient reviews.':
    {
      ru: 'Сортируйте по цене, рейтингу клиники или расстоянию. Смотрите реальные фото и проверенные отзывы.',
      kk: 'Бағаға, клиника рейтингіне немесе қашықтыққа қарай сұрыптаңыз. Нақты фото мен тексерілген пікірлерді көріңіз.',
    },
  'Pick the best offer and book an appointment directly through our platform. No hidden fees or extra charges.':
    {
      ru: 'Выберите лучшее предложение и запишитесь прямо через платформу. Без скрытых комиссий.',
      kk: 'Ең жақсы ұсынысты таңдап, платформа арқылы жазылыңыз. Жасырын комиссиясыз.',
    },

  // --- Footer (extended) ---
  'The "Aviasales" of medical care in Kazakhstan. All prices are collected from public clinic price lists for informational purposes only.':
    {
      ru: '«Aviasales» медицины в Казахстане. Все цены собраны из публичных прайс-листов клиник и приведены в справочных целях.',
      kk: 'Қазақстан медицинасының «Aviasales»-і. Барлық бағалар клиникалардың ашық прайстарынан жиналған, тек ақпараттық мақсатта.',
    },

  // --- Search (extended) ---
  Home: { ru: 'Главная', kk: 'Басты бет' },
  Search: { ru: 'Поиск', kk: 'Іздеу' },
  Reset: { ru: 'Сбросить', kk: 'Тазарту' },
  'Sort by:': { ru: 'Сортировка:', kk: 'Сұрыптау:' },
  'Price Range (₸)': { ru: 'Диапазон цен (₸)', kk: 'Баға аралығы (₸)' },
  From: { ru: 'От', kk: 'Бастап' },
  To: { ru: 'До', kk: 'Дейін' },
  'Cheapest first': { ru: 'Сначала дешёвые', kk: 'Алдымен арзаны' },
  'Most expensive': { ru: 'Сначала дорогие', kk: 'Алдымен қымбаты' },
  'Best rating': { ru: 'Лучший рейтинг', kk: 'Үздік рейтинг' },
  Nearest: { ru: 'Ближайшие', kk: 'Ең жақыны' },
  Retry: { ru: 'Повторить', kk: 'Қайталау' },
  "Couldn't load offers": { ru: 'Не удалось загрузить предложения', kk: 'Ұсыныстарды жүктеу мүмкін болмады' },
  'New search': { ru: 'Новый поиск', kk: 'Жаңа іздеу' },
  Previous: { ru: 'Назад', kk: 'Артқа' },
  Next: { ru: 'Вперёд', kk: 'Алға' },
  Page: { ru: 'Стр.', kk: 'Бет' },
  of: { ru: 'из', kk: '/' },
  service: { ru: 'услуга', kk: 'қызмет' },
  services: { ru: 'услуг', kk: 'қызмет' },
  clinic: { ru: 'клиника', kk: 'клиника' },
  clinics: { ru: 'клиник', kk: 'клиника' },

  // --- Clinic / Service detail (extended) ---
  'Clinic not found': { ru: 'Клиника не найдена', kk: 'Клиника табылмады' },
  Reception: { ru: 'Приём', kk: 'Қабылдау' },
  'Working hours': { ru: 'Часы работы', kk: 'Жұмыс уақыты' },
  'Price History': { ru: 'История цен', kk: 'Баға тарихы' },
  'Track this price': { ru: 'Отслеживать цену', kk: 'Бағаны қадағалау' },
  'Notify me': { ru: 'Уведомить меня', kk: 'Хабарлау' },
  'Book best offer': { ru: 'Записаться по лучшей цене', kk: 'Ең жақсы бағамен жазылу' },
  'Average Price': { ru: 'Средняя цена', kk: 'Орташа баға' },
  'Market Insight': { ru: 'Аналитика рынка', kk: 'Нарық талдауы' },
  compared: { ru: 'сравнивается', kk: 'салыстырылды' },
  Action: { ru: 'Действие', kk: 'Әрекет' },
  Rating: { ru: 'Рейтинг', kk: 'Рейтинг' },
  Freshness: { ru: 'Свежесть', kk: 'Жаңалығы' },
  Price: { ru: 'Цена', kk: 'Баға' },
  Clinic: { ru: 'Клиника', kk: 'Клиника' },

  // --- Account / favorites / map / records (extended) ---
  'Browse clinics': { ru: 'Смотреть клиники', kk: 'Клиникаларды қарау' },
  'View Clinic Profile': { ru: 'Открыть профиль клиники', kk: 'Клиника профилін ашу' },
  'saved clinic': { ru: 'сохранённая клиника', kk: 'сақталған клиника' },
  'saved clinics': { ru: 'сохранённых клиник', kk: 'сақталған клиника' },
  'Page not found': { ru: 'Страница не найдена', kk: 'Бет табылмады' },
  "The page you're looking for doesn't exist.": {
    ru: 'Запрашиваемая страница не существует.',
    kk: 'Сұралған бет жоқ.',
  },

  // --- Categories (extra forms) ---
  'Doctor visit': { ru: 'Приём врача', kk: 'Дәрігер қабылдауы' },
  'Doctor Visit': { ru: 'Приём врача', kk: 'Дәрігер қабылдауы' },
  Procedure: { ru: 'Процедура', kk: 'Рәсім' },
  Pending: { ru: 'В ожидании', kk: 'Күтілуде' },
  Confirmed: { ru: 'Подтверждено', kk: 'Расталды' },
  Status: { ru: 'Статус', kk: 'Күй' },
  Total: { ru: 'Всего', kk: 'Барлығы' },
  All: { ru: 'Все', kk: 'Барлығы' },
  Showing: { ru: 'Показано', kk: 'Көрсетілді' },

  // --- Dashboard ---
  'Health Overview': { ru: 'Обзор здоровья', kk: 'Денсаулық шолуы' },
  'Your clinical summary, built from your own activity.': {
    ru: 'Ваша клиническая сводка на основе ваших действий.',
    kk: 'Сіздің әрекеттеріңіз негізіндегі клиникалық қорытынды.',
  },
  'Verified Account': { ru: 'Подтверждённый аккаунт', kk: 'Расталған аккаунт' },
  'Welcome to your dashboard': { ru: 'Добро пожаловать в кабинет', kk: 'Кабинетке қош келдіңіз' },
  'Search for a medical service to compare prices...': {
    ru: 'Найдите медуслугу, чтобы сравнить цены...',
    kk: 'Бағаларды салыстыру үшін медқызметті іздеңіз...',
  },
  'Find a price': { ru: 'Найти цену', kk: 'Бағаны табу' },
  'Find a Price': { ru: 'Найти цену', kk: 'Бағаны табу' },
  'View Details': { ru: 'Подробнее', kk: 'Толығырақ' },
  'Next Appointment': { ru: 'Ближайшая запись', kk: 'Жақын жазылу' },
  'No appointments': { ru: 'Нет записей', kk: 'Жазылулар жоқ' },
  "You don't have any upcoming visits booked.": {
    ru: 'У вас нет предстоящих визитов.',
    kk: 'Сізде алдағы визиттер жоқ.',
  },
  'Upcoming Spend': { ru: 'Предстоящие расходы', kk: 'Алдағы шығындар' },
  'No upcoming costs.': { ru: 'Нет предстоящих расходов.', kk: 'Алдағы шығындар жоқ.' },
  Across: { ru: 'По', kk: 'Бойынша' },
  'upcoming appointment': { ru: 'предстоящая запись', kk: 'алдағы жазылу' },
  'upcoming appointments': { ru: 'предстоящих записей', kk: 'алдағы жазылу' },
  'Saved Clinics': { ru: 'Сохранённые клиники', kk: 'Сақталған клиникалар' },
  'View saved': { ru: 'Открыть избранное', kk: 'Таңдаулыны ашу' },
  'Save a clinic to compare it later.': {
    ru: 'Сохраните клинику, чтобы сравнить позже.',
    kk: 'Кейін салыстыру үшін клиниканы сақтаңыз.',
  },
  'Quick Actions': { ru: 'Быстрые действия', kk: 'Жылдам әрекеттер' },
  'My Appointments': { ru: 'Мои записи', kk: 'Менің жазылуларым' },
  'Medical Records': { ru: 'Медкарта', kk: 'Медициналық карта' },
  'Upcoming Appointments': { ru: 'Предстоящие записи', kk: 'Алдағы жазылулар' },
  'View All Appointments': { ru: 'Все записи', kk: 'Барлық жазылулар' },
  'No upcoming appointments yet. Compare prices and book your first visit.': {
    ru: 'Пока нет записей. Сравните цены и запишитесь на первый визит.',
    kk: 'Әзірге жазылу жоқ. Бағаларды салыстырып, алғашқы визитке жазылыңыз.',
  },
  'Recent Searches': { ru: 'Недавние поиски', kk: 'Соңғы іздеулер' },
  'No searches yet.': { ru: 'Пока нет поисков.', kk: 'Әзірге іздеу жоқ.' },
  'Start one now': { ru: 'Начать поиск', kk: 'Іздеуді бастау' },

  // --- Appointments ---
  'Manage your clinical visits and medical history': {
    ru: 'Управляйте визитами и историей лечения',
    kk: 'Визиттер мен емдеу тарихын басқарыңыз',
  },
  'Find a price & book': { ru: 'Найти цену и записаться', kk: 'Бағаны тауып, жазылу' },
  'Service Name': { ru: 'Услуга', kk: 'Қызмет' },
  'Date & Time': { ru: 'Дата и время', kk: 'Күні мен уақыты' },
  Actions: { ru: 'Действия', kk: 'Әрекеттер' },
  appointment: { ru: 'запись', kk: 'жазылу' },
  appointments: { ru: 'записей', kk: 'жазылу' },

  // --- Favorites ---
  'Saved Clinics & Favorites': { ru: 'Сохранённые клиники', kk: 'Сақталған клиникалар' },
  'Manage your preferred medical providers and compare their prices in one place.': {
    ru: 'Управляйте любимыми клиниками и сравнивайте их цены в одном месте.',
    kk: 'Таңдаулы клиникаларды басқарып, бағаларын бір жерде салыстырыңыз.',
  },

  // --- Medical records ---
  'Results from your completed appointments, in one secure place.': {
    ru: 'Результаты ваших завершённых визитов в одном защищённом месте.',
    kk: 'Аяқталған визиттеріңіздің нәтижелері бір қауіпсіз жерде.',
  },
  'View Appointments': { ru: 'Открыть записи', kk: 'Жазылуларды ашу' },
  'Records sync is not connected yet': {
    ru: 'Синхронизация результатов пока не подключена',
    kk: 'Нәтижелерді синхрондау әзірге қосылмаған',
  },
  'Completed Visits': { ru: 'Завершённые визиты', kk: 'Аяқталған визиттер' },
  'Storage Status': { ru: 'Состояние хранилища', kk: 'Қойма күйі' },
  'Securely Encrypted': { ru: 'Надёжно зашифровано', kk: 'Сенімді шифрланған' },
  'Results Sync': { ru: 'Синхронизация результатов', kk: 'Нәтижелерді синхрондау' },
  'Search records...': { ru: 'Поиск по записям...', kk: 'Жазбалардан іздеу...' },
  'No records match your search.': { ru: 'Ничего не найдено.', kk: 'Ештеңе табылмады.' },
  'Your results will appear here after completed appointments.': {
    ru: 'Результаты появятся здесь после завершённых визитов.',
    kk: 'Нәтижелер аяқталған визиттерден кейін осында пайда болады.',
  },
  'Results pending': { ru: 'Результаты в ожидании', kk: 'Нәтижелер күтілуде' },
  'Why pending?': { ru: 'Почему в ожидании?', kk: 'Неге күтілуде?' },

  // --- Service detail (more) ---
  'How prices for this service have moved over time.': {
    ru: 'Как менялась цена на эту услугу со временем.',
    kk: 'Осы қызмет бағасы уақыт өте өзгерді.',
  },
  'Get notified by email when a clinic drops its price for this service.': {
    ru: 'Получайте e-mail, когда клиника снизит цену на эту услугу.',
    kk: 'Клиника осы қызмет бағасын төмендеткенде e-mail алыңыз.',
  },
  "You're subscribed to price drops.": {
    ru: 'Вы подписаны на снижение цены.',
    kk: 'Сіз баға төмендеуіне жазылдыңыз.',
  },
  'Could not load offers': { ru: 'Не удалось загрузить предложения', kk: 'Ұсыныстарды жүктеу мүмкін болмады' },
  Service: { ru: 'Услуга', kk: 'Қызмет' },
  'Lowest price found:': { ru: 'Минимальная цена:', kk: 'Ең төмен баға:' },
  'Highest price found:': { ru: 'Максимальная цена:', kk: 'Ең жоғары баға:' },
  for: { ru: 'для', kk: 'үшін' },

  // --- Map (Russian source keys → add EN + KK) ---
  'Карта клиник': { en: 'Clinics map', kk: 'Клиникалар картасы' },
  'Все города': { en: 'All cities', kk: 'Барлық қалалар' },
  Город: { en: 'City', kk: 'Қала' },
  'Не удалось загрузить карту': { en: 'Could not load the map', kk: 'Картаны жүктеу мүмкін болмады' },
  'Попробуйте позже.': { en: 'Please try again later.', kk: 'Кейінірек қайталап көріңіз.' },
  'Нет клиник с координатами': {
    en: 'No clinics with coordinates',
    kk: 'Координаттары бар клиникалар жоқ',
  },
  'Открыть админ-панель →': { en: 'Open admin panel →', kk: 'Әкімші панелін ашу →' },

  // --- Home bento cards (with numbers) ---
  'High-precision imaging starting from 15,000 ₸. Compare 45 clinics.': {
    ru: 'Высокоточная визуализация от 15 000 ₸. Сравните 45 клиник.',
    kk: 'Жоғары дәлдікті бейнелеу 15 000 ₸-ден. 45 клиниканы салыстырыңыз.',
  },
  'Complete panels from 2,500 ₸': { ru: 'Полные панели от 2 500 ₸', kk: 'Толық панельдер 2 500 ₸-ден' },
  '98 labs available': { ru: '98 лабораторий', kk: '98 зертхана' },
  'Appointments from 5,000 ₸': { ru: 'Приёмы от 5 000 ₸', kk: 'Қабылдау 5 000 ₸-ден' },
  '450+ doctors': { ru: '450+ врачей', kk: '450+ дәрігер' },
  'Hygiene from 12,000 ₸': { ru: 'Гигиена от 12 000 ₸', kk: 'Гигиена 12 000 ₸-ден' },
  '120 dental centers': { ru: '120 стоматологий', kk: '120 стоматология' },
  'Screening from 4,000 ₸': { ru: 'Скрининг от 4 000 ₸', kk: 'Скрининг 4 000 ₸-ден' },
  '215 cabinets': { ru: '215 кабинетов', kk: '215 кабинет' },
}
