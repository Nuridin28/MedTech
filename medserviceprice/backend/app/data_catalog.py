"""Seed reference catalog (TZ §6.2) — normalized service positions + synonyms.

This is *reference* data (the dictionary raw scraped names are mapped onto), not
prices. Prices always come from real scraping. 60 positions across all four
categories, with Russian/Kazakh/English synonyms so normalization (lexical + fuzzy
+ semantic) can attach KDL's raw analysis names.
"""
from __future__ import annotations

# (name_norm, category, [synonyms])
CATALOG: list[tuple[str, str, list[str]]] = [
    # --- Laboratory: hematology ---
    ("Общий анализ крови (ОАК)", "laboratory", ["ОАК", "клинический анализ крови", "CBC", "общий анализ крови без СОЭ", "complete blood count"]),
    ("Клинический анализ крови с лейкоцитарной формулой и СОЭ", "laboratory", ["ОАК + СОЭ", "развёрнутый анализ крови", "клинический анализ крови с лейкоформулой"]),
    ("Скорость оседания эритроцитов (СОЭ)", "laboratory", ["СОЭ", "ESR"]),
    ("Подсчёт ретикулоцитов", "laboratory", ["ретикулоциты", "reticulocytes"]),
    ("Группа крови и резус-фактор", "laboratory", ["группа крови", "резус фактор", "blood group", "Rh"]),
    ("Коагулограмма", "laboratory", ["гемостаз", "свёртываемость крови", "МНО", "ПТИ", "coagulation"]),
    # --- Laboratory: biochemistry ---
    ("Глюкоза крови", "laboratory", ["глюкоза", "сахар крови", "кровь на сахар", "glucose"]),
    ("Гликированный гемоглобин (HbA1c)", "laboratory", ["гликированный гемоглобин", "HbA1c", "гликогемоглобин"]),
    ("Липидный профиль", "laboratory", ["липидограмма", "холестерин", "холестерол", "lipid panel", "ЛПНП", "ЛПВП"]),
    ("Общий холестерин", "laboratory", ["холестерин общий", "cholesterol total"]),
    ("Аланинаминотрансфераза (АЛТ)", "laboratory", ["АЛТ", "ALT", "аланинаминотрансфераза"]),
    ("Аспартатаминотрансфераза (АСТ)", "laboratory", ["АСТ", "AST", "аспартатаминотрансфераза"]),
    ("Билирубин общий", "laboratory", ["билирубин", "bilirubin"]),
    ("Креатинин", "laboratory", ["креатинин", "creatinine"]),
    ("Мочевина", "laboratory", ["мочевина", "urea"]),
    ("Мочевая кислота", "laboratory", ["мочевая кислота", "uric acid"]),
    ("С-реактивный белок (СРБ)", "laboratory", ["СРБ", "CRP", "c-реактивный белок"]),
    ("Общий белок", "laboratory", ["общий белок", "total protein"]),
    ("Железо сыворотки", "laboratory", ["железо", "сывороточное железо", "iron", "ферритин"]),
    ("Электролиты (калий, натрий, хлор)", "laboratory", ["электролиты", "калий", "натрий", "electrolytes"]),
    # --- Laboratory: hormones ---
    ("Тиреотропный гормон (ТТГ)", "laboratory", ["ТТГ", "TSH", "тиреотропный гормон"]),
    ("Свободный тироксин (Т4 свободный)", "laboratory", ["Т4 свободный", "free T4", "тироксин"]),
    ("Свободный трийодтиронин (Т3 свободный)", "laboratory", ["Т3 свободный", "free T3"]),
    ("Профиль щитовидной железы", "laboratory", ["обследование щитовидной железы", "щитовидка", "thyroid panel", "ТТГ Т3 Т4"]),
    ("Витамин D (25-OH)", "laboratory", ["витамин D", "25-OH витамин D", "vitamin D"]),
    ("Витамин B12", "laboratory", ["витамин B12", "цианокобаламин", "vitamin B12"]),
    ("Кортизол", "laboratory", ["кортизол", "cortisol"]),
    ("Тестостерон общий", "laboratory", ["тестостерон", "testosterone"]),
    ("Пролактин", "laboratory", ["пролактин", "prolactin"]),
    ("Инсулин", "laboratory", ["инсулин", "insulin"]),
    # --- Laboratory: immunology / infections / markers ---
    ("Ферритин", "laboratory", ["ферритин", "ferritin"]),
    ("ПСА общий (простатspecифический антиген)", "laboratory", ["ПСА", "PSA", "простатический антиген"]),
    ("Онкомаркер СА-125", "laboratory", ["СА 125", "CA-125", "онкомаркер яичников"]),
    ("Антитела к ВИЧ (скрининг)", "laboratory", ["ВИЧ", "HIV", "антитела к ВИЧ"]),
    ("Гепатит B (HBsAg)", "laboratory", ["гепатит B", "HBsAg", "австралийский антиген"]),
    ("Гепатит C (anti-HCV)", "laboratory", ["гепатит C", "anti-HCV", "антитела к гепатиту C"]),
    ("ПЦР на COVID-19", "laboratory", ["ПЦР COVID", "коронавирус ПЦР", "covid pcr", "ОРВИ скрин"]),
    ("Антитела IgG к SARS-CoV-2", "laboratory", ["антитела к коронавирусу", "covid igg", "IgG SARS-CoV-2"]),
    ("Аллергопанель (скрининг)", "laboratory", ["аллергены", "аллергопанель", "allergy panel"]),
    # --- Laboratory: urine ---
    ("Общий анализ мочи (ОАМ)", "laboratory", ["ОАМ", "анализ мочи", "urinalysis"]),
    ("Анализ мочи по Нечипоренко", "laboratory", ["Нечипоренко", "моча по Нечипоренко"]),
    # --- Diagnostics: imaging ---
    ("МРТ головного мозга", "diagnostics", ["МРТ головы", "магнитно-резонансная томография головного мозга", "brain MRI"]),
    ("МРТ позвоночника", "diagnostics", ["МРТ спины", "МРТ позвоночника", "spine MRI"]),
    ("КТ грудной клетки", "diagnostics", ["КТ лёгких", "компьютерная томография грудной клетки", "chest CT"]),
    ("КТ головного мозга", "diagnostics", ["КТ головы", "компьютерная томография головного мозга", "brain CT"]),
    ("УЗИ органов брюшной полости", "diagnostics", ["УЗИ живота", "УЗИ брюшной полости", "abdominal ultrasound"]),
    ("УЗИ щитовидной железы", "diagnostics", ["УЗИ щитовидки", "thyroid ultrasound"]),
    ("УЗИ органов малого таза", "diagnostics", ["УЗИ малого таза", "pelvic ultrasound"]),
    ("УЗИ почек", "diagnostics", ["УЗИ почек", "kidney ultrasound"]),
    ("Электрокардиограмма (ЭКГ)", "diagnostics", ["ЭКГ", "кардиограмма", "ECG", "EKG"]),
    ("Рентген грудной клетки", "diagnostics", ["флюорография", "рентген лёгких", "chest x-ray"]),
    ("Маммография", "diagnostics", ["маммография", "mammography"]),
    ("Эхокардиография (УЗИ сердца)", "diagnostics", ["ЭхоКГ", "УЗИ сердца", "echocardiography"]),
    # --- Doctor visits ---
    ("Приём терапевта", "doctor_visit", ["терапевт", "врач общей практики", "GP", "консультация терапевта"]),
    ("Приём кардиолога", "doctor_visit", ["кардиолог", "консультация кардиолога", "cardiologist"]),
    ("Приём отоларинголога (ЛОР)", "doctor_visit", ["ЛОР", "отоларинголог", "болит горло", "ENT"]),
    ("Приём невролога", "doctor_visit", ["невролог", "неврология", "neurologist"]),
    ("Приём эндокринолога", "doctor_visit", ["эндокринолог", "endocrinologist"]),
    ("Приём гинеколога", "doctor_visit", ["гинеколог", "gynecologist"]),
    ("Приём дерматолога", "doctor_visit", ["дерматолог", "dermatologist", "кожный врач"]),
    ("Приём уролога", "doctor_visit", ["уролог", "urologist"]),
    # --- Procedures ---
    ("Забор крови из вены", "procedure", ["взятие крови", "венепункция", "забор крови", "blood draw"]),
    ("Профессиональная гигиена полости рта", "procedure", ["чистка зубов", "гигиена полости рта", "teeth cleaning"]),
    ("Внутримышечная инъекция", "procedure", ["укол", "инъекция", "injection"]),
    ("Капельница (внутривенная инфузия)", "procedure", ["капельница", "инфузия", "IV drip"]),
]
