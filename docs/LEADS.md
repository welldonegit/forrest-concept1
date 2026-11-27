# Заявки с лендинга

## Как работает
- Одна функция POST /api/lead на Cloudflare Worker, только для /api/*;
  статика через обработчик не идёт.
- Порядок: ключ повтора → проверка данных и капчи → запись в D1 →
  ответ посетителю → отправка в Telegram и CRM в фоне, независимо
  друг от друга, с таймаутами на запросы.
- Успех для посетителя — запись в D1. Сбой каналов он не видит.
- У заявки статус по каждому каналу: отправлено, ожидает, не доставлена,
  не настроен.
- Канал без ключей — «не настроен»; после добавления ключей включается
  без правки кода. Заявки, пришедшие, пока канал не настроен, после
  добавления ключей НЕ досылаются — они остаются в базе.
- Хранение 90 дней, потом автоудаление. Удалённые строки ещё 7 дней
  (бесплатный тариф) или 30 дней (платный) восстанавливаются через
  D1 Time Travel — учесть в политике конфиденциальности.
- Защита: Turnstile, поле-ловушка, лимит частоты (встроенный
  ограничитель Cloudflare, без Durable Objects), ключ повтора от
  двойного нажатия.

## Повторы
- Первая попытка — сразу после записи в базу.
- Не дошло — два повтора: через 10 минут и через час.
- После этого статус «не доставлена», больше попыток нет; в Telegram
  уходит служебное сообщение о сбое — одно на серию, не на каждую
  заявку.
- Расписание раз в 10 минут только проверяет базу; если заявок
  к повтору нет, внешних запросов не делает.
- Не успело за время фоновой отправки (таймаут) — дошлёт расписание.

## Двойное нажатие
- Ключ повтора проверяется до проверки токена Turnstile; на повтор
  отвечаем результатом первой отправки.
- Для сетевых повторов проверки токена — idempotency_key в siteverify.

## Что в заявке
- Источник: форма «Фінмодель», финальная форма, квиз, попап апартамента, окно мира, попап «Звʼязатися».
- Поля формы (телефон обязателен во всех формах), для квиза — ответы
  (формат, бюджет, месенджер) и расчёт; язык, адрес страницы, время по Киеву, номер заявки.
  Квиз (выгрузка 2026-11-25): имя, телефон, месенджер → contactMethod; email и согласия нет.
- Значения, выбранные в форме (цель, способ связи, формат, ответы и
  вопросы квиза, бюджет), — по-украински при любом языке страницы: у варианта
  атрибут data-uk с украинской подписью из Sanity (ставится при сборке, если
  подпись отличается). Язык посетителя — отдельным полем lang.
- «Фінмодель»: поле «Площа апартаментів» → format (название формата,
  не переводится) + areaFrom/areaTo (числа); «Ще не визначився» — в format.
  Финальная: «Який формат інвестиції вас цікавить?» — цель → purpose.
- UTM (source, medium, campaign, content, term), gclid, fbclid, referrer,
  страница входа. Cookie gp_utm (Path=/), 30 дней, по последнему переходу;
  одна на все языки: «/» (украинский) и «/en/» — один сайт. Заход по
  старому адресу /uk/…?utm_… → 301 на тот же адрес без /uk/ с метками.

## Сайт
- Отправка без перезагрузки → страница «Дякуємо» (все четыре источника);
  при ошибке текст из Sanity, данные не теряются, перехода нет.
- Без JS вместо кнопки — телефон и мессенджеры.
- Turnstile грузится, когда посетитель дошёл до формы. Истёкший токен
  обновляется тихо.
- Ключей Turnstile по умолчанию в коде нет. Боевой домен и превью
  (*.workers.dev) — одна настоящая пара (оба адреса в доменах виджета).
  Тестовая пара Cloudflare — только localhost. Без ключей форма
  показывает ошибку, а не пропускает заявки.
- При успехе — событие generate_lead с телефоном и email в user_data
  (раздел «Аналитика»).

## Telegram
- Заголовок «Заявка з лендінгу Forrest», поля по строке, пустые
  не выводить, UTM, gclid и fbclid — блоком «Джерело» (нет меток — блока нет).
  Страница, referrer и landing в сообщение не выводятся (2026-11-26): они
  в D1 и в CRM. HTML с экранированием.
- Служебные сообщения: о сбое канала после исчерпания повторов (одно
  на серию) и о восстановлении.

## Telegram и расписание: как устроено (5.3)
- Код: worker/channels/telegram.ts (сообщения, sendMessage), alerts.ts (серия
  сбоев), dispatch.ts (попытка + запись результата), worker/scheduled.ts (cron).
- sendMessage, parse_mode HTML, без превью ссылок; экранируются < > & ";
  текст до 4096 символов — длинное укорачивается с пометкой «повністю в базі».
- Подписи сообщений — для отдела продаж, в коде (не в Sanity): посетитель
  их не видит. Квиз: формат, бюджет и месенджер — один раз, в блоке ответов
  (месенджер квиза — это contactMethod, «Звʼязок» отдельной строкой не выводится); код страны
  не выводится (он в начале телефона).
- Ошибка Telegram, таймаут 10 с, 429 — попытка неудачна, повтор по расписанию.
  migrate_to_chat_id (группа стала супергруппой) — отправка на новый ID в той
  же попытке, в журнал — подсказка с новым ID (не личные данные).
- Серия сбоев — таблица channel_alerts: первая «не доставлена» открывает
  серию и шлёт одно служебное сообщение; первая успешная доставка закрывает
  серию одним сообщением с номерами недоставленных. Служебные — одна попытка,
  без личных данных; если лежит сам Telegram, видно в сообщении о восстановлении.
- Cron */10: очистка (заявки старше 90 дней, брошенные ключи повтора старше
  суток), затем до 10 доставок со сроком; доставка забирается «арендой» на
  15 минут, чтобы два запуска не отправили одно и то же. Нет доставок к
  повтору — внешних запросов нет.
- Нет ответа от Telegram — возможен дубль сообщения при повторе (у sendMessage
  нет ключа повтора); для CRM — поиск по номеру (5.4).
- Тесты: npm run test:schedule (поддельный Bot API, TELEGRAM_API_BASE только
  в тестовом окружении).

## CRM G-PLUS (по docs/crm/api_schema.yaml)
- POST https://crm.g-plus.app/api/v1/leads, Authorization: Token <ключ>,
  успех 201. Обязательны query-параметр fields, contact.name, added_at.
- source — строковый ключ из /api/v1/lead_sources; stage_id — строка
  из /api/v1/pipelines; objects — [{id}] из /api/v1/buildings (нужно
  право buildings.read).
- Поля: телефон → contact.phone_numbers; способ связи →
  contact.preferred_contact_method; язык → contact.language (uk → ua);
  цель → note_purpose; формат → note_section; площадь →
  note_square_from/to; бюджет → note_budget + note_budget_currency.
- Языки, которых нет в списке CRM (ru, ka, en, de, es, tr, he, pl, ua,
  ar, zh-cn): contact.language не передаём, язык дописываем в note.
- Ограничения полей по схеме: площадь — строка-число (до 6 цифр, 2 знака
  после запятой); note_budget до 100 символов; note_section и
  note_purpose до 150; contact.name до 140; preferred_contact_method
  до 128; валюта — из списка CRM. Длинные значения обрезаются.
- note начинается с «Заявка з лендінгу Forrest», далее номер заявки,
  источник, адрес страницы и всё, для чего нет отдельного поля.
- UTM → data.utm (подтвердить пробной отправкой в 5.4); запасной
  вариант — кастомные поля, если заданы их ID.
- Дубли: у создания лида нет ключа повтора. Если попытка закончилась
  таймаутом или обрывом (ответа нет), перед повтором ищем лид по номеру
  заявки; нашёлся — помечаем отправленным. При явной ошибке от CRM
  поиск не нужен.
- Модуль писать так, чтобы позже можно было добавить второй способ
  отправки (старый Forms API).

## CRM: как устроено (5.4)
- Код: worker/channels/crm.ts — buildCrmLead (тело лида, чистая функция) и
  транспорт publicApiV1 (интерфейс CrmTransport: второй способ — старый
  Forms API — добавляется ещё одним транспортом).
- POST /api/v1/leads?fields=id, Authorization: Token, успех — 201 (id → external_id).
- Нет ответа (таймаут, обрыв, 502, 504) — last_error «no_response: …»;
  следующая попытка сначала ищет лид: GET /api/v1/leads?fields=id,note,
  added_at ±1 мин, source; совпадение строки «Номер: FR-…» в note — отправлено.
  Явная ошибка (4xx, 500) — поиск не нужен, повтор по расписанию.
- Ошибка 400 записывается путями полей (contact.email), без текстов DRF:
  в них бывают введённые значения.
- Сбой CRM и восстановление — те же служебные сообщения в Telegram, что
  для Telegram (серия, alerts.ts).
- Команды с токеном человека: npm run crm:explore | crm:check | crm:delete
  (scripts/crm/, docs/ADMIN.md). Тело лида проверяется по этой схеме:
  scripts/lib/crm-schema.mjs; тесты — npm run test:crm.

| Поле заявки | Поле CRM | Примечание |
|---|---|---|
| fields.name | contact.name (≤140) | обязателен в CRM; нет имени (квиз, апартамент, попап «Звʼязатися») — «Заявка з сайту FR-…»; длиннее — полностью в note |
| fields.phone | contact.phone_numbers[0] | +380…, без пробелов |
| fields.email | contact.email (≤140) | нет — нет ключа; длиннее 140 — только в note |
| fields.contactMethod | contact.preferred_contact_method (≤128) | украинской подписью |
| fields.contactMethod | кастомное «Вибір зручного способу зв'язку» (CRM_FIELD_CONTACT_METHOD, multiselect) | Telegram, WhatsApp, Viber; звонок → «Мобільний»; нет соответствия — не передаём |
| fields.format / fields.apartment | кастомное «Тип планування» (CRM_FIELD_LAYOUT, multiselect) | Superior → Standart/Superior, Deluxe → Deluxe/Premium apartments, Family → Famili Suites/Apartments, Junior Suite → Junior/Executive suite, Presidential → Presidential/Premium room; «Ще не визначився» и прочее — не передаём |
| gclid, fbclid | кастомные «Google Click ID», «Fbclid» (CRM_FIELD_GCLID / _FBCLID) | ID не задан — в note |
| lang | contact.language | uk → ua, en → en; нет в LanguageEnum — «Мова: …» в note |
| fields.purpose (финальная форма) | note_purpose (≤150) | |
| fields.format (Фінмодель, квиз) / fields.apartment (попап) | note_section (≤150) | |
| fields.areaFrom / areaTo | note_square_from / to | ^\d{0,6}(\.\d{0,2})?$ |
| fields.budget | note_budget (≤100) + note_budget_currency | валюта: budgetCurrency из списка CRM или по знаку ($ → usd) |
| время записи в D1 | added_at | ISO 8601 |
| CRM_SOURCE / CRM_STAGE_ID / CRM_BUILDING_ID | source / stage_id / objects [{id}] | пусто — не передаём |
| utm_source…utm_term | data.utm | + data.custom_field_values, если задан CRM_UTM_FIELDS |
| номер, источник, страница, время по Киеву, согласие, ответы и расчёт квиза, referrer, landing, всё длинное | note | начинается с «Заявка з лендінгу Forrest\nНомер: FR-…» |
| fields.world (попап мира) | note: «Секція: ROCK» | отдельного поля и объекта в CRM нет (решение 2026-11-25); в Telegram — строка «Секція» |
| fields.country (код страны телефона) | — | уже в номере |

## Настройки (2026-11-20, из npm run crm:explore)
- TELEGRAM_CHAT_ID = -1003990676609 (группа для заявок, 2026-11-20).
- CRM_SOURCE = developer-site (источник «Сайт»); CRM_BUILDING_ID = 26458
  (FORREST TRINITY RESORT); CRM_STAGE_ID пусто — этапа для новых заявок
  в воронке нет, лид встаёт на первый этап CRM (accepted, «Не має зв'язку»).
- UTM — в data.utm: кастомных полей под UTM в CRM нет (CRM_UTM_FIELDS пусто).
- Кастомные поля лида → data.custom_field_values { ID: значение }; ID — в
  wrangler.jsonc (CRM_FIELD_*), значения — точно как варианты в CRM,
  multiselect — массивом из одного варианта. Соответствие — worker/channels/crm.ts;
  npm run crm:check сверяет ID, тип и каждый вариант со списком CRM до
  создания лида и показывает, сохранились ли поля. Сравнение «надіслано → в CRM»
  — без учёта порядка ключей (data.utm), телефон — только цифрами.
- crm:check с настоящим токеном (2026-11-20, человек): лид создан, телефон,
  data.utm и кастомные поля сохранились; CRM_UTM_FIELDS не нужны. Менеджер
  не назначился, этап «—» — вопрос клиенту (ROADMAP, «Открытые вопросы»).
- Домены — wrangler.jsonc → routes (custom domains); основной адрес workers.dev
  выключен 2026-11-27, превью веток — адреса версий (docs/ADMIN.md, «Домен»).

## Секреты и настройки
- Секреты (токен бота, токен CRM, секрет Turnstile) — только в секретах
  Cloudflare и локальном файле вне Git (.dev.vars). В чат не запрашивать.
- Несекретные настройки (ID чата, этапа, источника, здания, публичный
  ключ Turnstile) — в wrangler.jsonc.
- В Sanity и в журналы личные данные не попадают, в том числе
  в отладке.

## Формат запроса (5.1)
- POST /api/lead, Content-Type: application/json, тот же адрес сайта
  (чужой Origin — 403).
- Тело: key (UUID на одну попытку отправки формы, повтор — тот же key),
  form (finmodel | final | quiz | apartment | world | contact), lang, page (адрес страницы: https://…/ — украинская,
  https://…/en/ — английская),
  turnstileToken, website (поле-ловушка, пустое), fields { name, phone,
  email, consent, contactMethod, format, purpose, areaFrom, areaTo,
  budget, budgetCurrency, apartment, world, country }, quiz { answers:
  [{ question, answer }], calc: { ключ: число или строка } }.
- Имя обязательно в finmodel, final и world; телефон — везде (7–15 цифр).
- contact — попап «Звʼязатися» (кнопка в шапке, выгрузка 2026-11-25): fields.name (по желанию), fields.phone; больше полей нет.
- world — окно «Детальніше» мира (выгрузка 2026-11-25): fields.world = WIND | ROCK | SUN (название мира из Sanity),
  contactMethod — украинской подписью; email и согласия нет.
- Источник визита — из cookie gp_utm (encodeURIComponent(JSON) с ключами
  utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid,
  fbclid, referrer, landing), не из тела запроса.
- Ответ: { ok: true, number: "FR-000042" } или { ok: false, error: код,
  fields?: [...] }. Коды: validation, captcha, captcha_unavailable,
  rate_limited, in_progress, invalid_json, payload_too_large,
  unsupported_media_type, forbidden, method_not_allowed, server_error.
  Текст для посетителя — из Sanity по коду (5.2).
- Код: worker/ (вход — worker/index.ts), тесты — npm run test:api.

## Сайт: как устроено (5.2)
- Код: src/scripts/ui/lead-api.js (отправка, ключ повтора, ошибки,
  goThanks — событие и переход), captcha.js (Turnstile), attribution.js (cookie gp_utm);
  формы — lead-form.js, popups/quiz.js, popups/apartments.js, popups/world.js, popups/contact.js.
- После успеха все источники — страница «Дякуємо» (/thanks/,
  /en/thanks/; адрес — html[data-thanks] из routes.ts). Своего шага
  «Дякуємо» у квиза и подписи успеха на кнопке попапа апартамента нет
  (решение 2026-11-25, отличие от выгрузки).
- Публичный ключ Turnstile попадает в сборку из wrangler.jsonc → vars →
  TURNSTILE_SITE_KEY: одна настоящая пара для боевого домена и превью;
  секрет — TURNSTILE_SECRET_KEY в панели (2026-11-20).
- localhost: тестовый ключ Cloudflare только из окружения сборки
  (TURNSTILE_LOCAL_SITE_KEY, npm run build:test), в боевую сборку не
  попадает; тестовый секрет Worker принимает только на localhost.
- Ошибка отправки видна над кнопкой отправки и читается дикторами (role=alert).
- Скрипт Turnstile грузится, когда форма подошла к экрану или открыт
  попап; виджет создаётся при первом касании полей; виден, только если
  Cloudflare просит действие посетителя.
- Событие — generate_lead, раздел «Аналитика». lead_submit больше нет.
- Без JS форма отправляется обычным POST → сервер возвращает на ту же
  страницу (303), ничего не записывая.

## Аналитика (2026-11-25)
- Одно событие generate_lead на одну заявку — только после ответа
  /api/lead { ok: true } (заявка в D1). Не по клику, не при ошибке
  проверки полей или отправки. GTM-WPFP499D (siteSettings.analytics.gtmId)
  запускает по нему конверсии Google Ads, GA4 и Facebook Lead.
- Порядок: успех → lead-api.js, goThanks() кладёт событие в sessionStorage
  (ключ lead_event) → переход на «Дякуємо» → Base.astro (leadEvent) читает
  lead_event, сразу удаляет, кладёт в dataLayer после gtm.start и грузит
  gtm.js сразу, не дожидаясь действия посетителя. Без lead_event GTM на
  «Дякуємо» отложенный, как везде. Обновление «Дякуємо» и прямой заход
  события не дают.
- Двойное нажатие: кнопки неактивны, пока идёт запрос; после успеха форма
  остаётся заблокированной до ухода со страницы (возврат «Назад» из bfcache
  её разблокирует); повтор с тем же ключом сервер отвечает первой заявкой.
- Параметры:
  dataLayer.push({ event: 'generate_lead', lead_id: 'FR-000042',
    form_id, form_name, form_location: location.pathname страницы формы,
    user_data: { email, phone_number } })
  | form_id | form_name |
  |---|---|
  | finmodel | Форма «Фінмодель» |
  | final_form | Фінальна форма |
  | quiz | Квіз «Розрахунок доходу» |
  | apartment_popup | Попап апартаменту |
  | world_popup | Попап світу |
  | contact_popup | Попап «Зв'язатися» |
- user_data: phone_number — E.164 (+380XXXXXXXXX, из маски; в квизе — код
  страны + номер); email — если поле есть в форме (с квиза 2026-11-25 его нет ни в одной форме).
  Пустые ключи не передаются; нет ни телефона, ни email — нет user_data.
- Личные данные: не в журналы (консоль, Worker) и не в localStorage;
  в sessionStorage — только до чтения на «Дякуємо».
- sessionStorage недоступен (запрещён, приватный режим) — запасной путь:
  /thanks/?lead_id=FR-…&form_id=…&form_location=/ — без телефона и email;
  form_name берётся из src/lib/lead-forms.ts; событие без user_data.
  Параметры сразу убираются из адреса (обновление события не даёт);
  неизвестный form_id или номер не FR-… — события нет.
- Таблица form_id / form_name — одна, src/lib/lead-forms.ts.

### Источник world_popup — окно «Детальніше» мира (2026-11-25)
- Где: кнопка «Детальніше про …» на карточке блока «Три світи» → окно мира
  (WIND / ROCK / SUN), форма внизу окна. Код — src/scripts/popups/world.js.
- Тело: form: 'world'; fields: name (обязательно), phone (обязательно),
  contactMethod (украинской подписью из Sanity), world (название мира из Sanity).
  Email и согласия нет.
- dataLayer на «Дякуємо»: form_id = world_popup, form_name = «Попап світу»,
  user_data.phone_number.
- Telegram: «№ FR-… · Попап світу», строки «Імʼя», «Телефон», «Звʼязок»,
  «Секція: ROCK», затем страница, время и UTM — как у других источников.
- CRM: contact.name, contact.phone_numbers, contact.preferred_contact_method,
  contact.language; note — «Заявка з лендінгу Forrest», номер,
  «Джерело: попап світу», страница, время, «Секція: ROCK». Отдельного поля
  и объекта для секции в CRM нет (решение 2026-11-25); формат, площадь,
  бюджет не передаются — в форме их нет.
- Тесты: npm run test:e2e (источник world), npm run test:crm (секция в note).
- Политика конфиденциальности должна упоминать передачу данных заявки
  в Google и Facebook — вопрос клиенту (ROADMAP).
- Проверка — docs/ADMIN.md, «Аналітика заявок»; тесты — npm run test:e2e.

### Источник contact_popup — попап «Звʼязатися» (2026-11-25)
- Где: кнопка «Звʼязатися» в шапке (все страницы: главная, архив, документы, «Дякуємо», 404) → попап
  «Передзвоніть мені» (выгрузка design-export/updates/2026-11-25-contact-popup/). Код — src/scripts/popups/contact.js.
  Без JS кнопка — ссылка tel: на «Контакти → Телефон для дзвінка».
- Тело: form: 'contact'; fields: name (по желанию — так в выгрузке), phone (обязательно). Способа связи,
  email и согласия нет.
- dataLayer на «Дякуємо»: form_id = contact_popup, form_name = «Попап «Зв'язатися»», user_data.phone_number.
- Telegram:
  ```
  Заявка з лендінгу Forrest
  № FR-000128 · Попап «Звʼязатися» (шапка)
  25.11.2026, 16:05 (Київ) · мова: uk

  Імʼя: Олена
  Телефон: +380671234567

  Джерело
  utm_source: google
  …
  ```
  Нет имени — строки «Імʼя» нет.
- CRM: contact.name (нет — «Заявка з сайту FR-…»), contact.phone_numbers, contact.language; note —
  «Заявка з лендінгу Forrest», номер, «Джерело: попап «Звʼязатися» (шапка)», страница, время, UTM.
  preferred_contact_method, формат, цель, бюджет не передаются — в форме их нет.
- Тесты: npm run test:e2e (источник contact), npm run test:crm (без имени и с именем),
  npm run test:ui (кнопка и попап на всех страницах).

## Этапы
5.1 Сервер: /api/lead, D1, проверки, защита, статусы каналов.
5.2 Сайт: формы, UTM, капча, «Дякуємо», вариант без JS, dataLayer.
5.3 Telegram и расписание: отправка, повторы, очистка 90 дней.
5.4 CRM: отправка, скрипты разведки и проверки, сообщение о сбое,
    docs/ADMIN.md, итоговый замер скорости.

Проверка с настоящими ключами — отдельным чек-листом (ROADMAP,
«Проверка этапа» 5).
