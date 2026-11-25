# Сайт FORREST: конверсии по заявкам через GTM

Инструкция для маркетолога. Контейнер: **GTM-WPFP499D**.

## Какое событие приходит

После каждой успешной заявки посетитель попадает на страницу «Дякуємо» (`/thanks/` или `/en/thanks/`). На этой странице сайт один раз отправляет в `dataLayer` такое событие:

```js
{
  event: 'generate_lead',
  lead_id: 'FR-000042',           // номер заявки, как в CRM и Telegram
  form_id: 'quiz',                // какая форма
  form_name: 'Квіз «Розрахунок доходу»',
  form_location: '/',             // страница, где была форма: '/' или '/en/'
  user_data: {
    phone_number: '+380671234567', // E.164
    email: 'name@example.com'      // только если заполнен
  }
}
```

**Значения `form_id`:**

| form_id | Форма |
|---|---|
| `finmodel` | Форма «Фінмодель» |
| `final_form` | Финальная форма |
| `quiz` | Квиз «Розрахунок доходу» |
| `apartment_popup` | Попап апартамента |

**Важно знать:**

- Событие приходит только после того, как заявка записана на сервере. Клик по кнопке и ошибки формы событие не создают.
- Одна заявка — ровно одно событие. Обновление «Дякуємо» и прямой заход на неё события не дают.
- Email есть только в квизе. В остальных формах в `user_data` только телефон.
- В редких браузерах, где запрещено хранилище сессии, событие придёт без `user_data`. Остальные параметры будут на месте.
- Имя события `generate_lead` не меняется.

## 1. Переменные

Variables → User-Defined → **Data Layer Variable**:

| Имя переменной в GTM | Data Layer Variable Name |
|---|---|
| DLV - lead_id | `lead_id` |
| DLV - form_id | `form_id` |
| DLV - form_name | `form_name` |
| DLV - form_location | `form_location` |
| DLV - email | `user_data.email` |
| DLV - phone | `user_data.phone_number` |

И ещё одна: **User-Provided Data** (тип «Данные, предоставленные пользователем») → Manual configuration. Email — `{{DLV - email}}`, Phone — `{{DLV - phone}}`.

## 2. Триггер

Custom Event, Event name: `generate_lead`, срабатывает на всех таких событиях. Название, например: «CE - generate_lead».

## 3. GA4

- Тег **Google Analytics: GA4 Event**, Event Name: `generate_lead`.
- Параметры события: `lead_id`, `form_id`, `form_name`, `form_location` — из переменных выше.
- Включить «Include user-provided data from your website» и выбрать переменную User-Provided Data.
- Триггер: «CE - generate_lead».
- В GA4: Admin → Events → отметить `generate_lead` как ключевое событие (Key event).

## 4. Google Ads

- Тег **Google Ads Conversion Tracking**: Conversion ID и Label — из конверсии «Лид» в Ads.
- Transaction ID: `{{DLV - lead_id}}` — защита от двойного учёта.
- Включить расширенные конверсии (Enhanced conversions) с переменной User-Provided Data. В самом Ads тоже включить: Цели → Конверсии → Настройки → Расширенные конверсии → Google Tag Manager.
- Триггер: «CE - generate_lead».
- Нужен тег **Conversion Linker** на All Pages, если его ещё нет.
- Считайте конверсию одним способом: либо этим тегом, либо импортом `generate_lead` из GA4. Если сделать и то и другое как основные конверсии, заявки посчитаются дважды.

## 5. Facebook (Meta) — Lead

- Базовый код пикселя на All Pages (Custom HTML или шаблон Meta Pixel из галереи). Расширенное сопоставление: `em` — `{{DLV - email}}`, `ph` — `{{DLV - phone}}`. Пиксель сам нормализует и хеширует данные.
- Тег события **Lead** на триггере «CE - generate_lead»:

  ```html
  <script>
    fbq('track', 'Lead', {
      content_name: {{DLV - form_name}},
      content_category: {{DLV - form_id}}
    }, { eventID: {{DLV - lead_id}} });
  </script>
  ```

- `eventID` = номер заявки: если позже подключат Conversions API, по нему уберутся дубли.
- Порядок срабатывания: базовый пиксель должен сработать раньше Lead. В настройках тега Lead → Tag Sequencing → «Fire a tag before» → базовый пиксель.

## 6. Проверка

1. GTM → **Preview** → ввести адрес сайта.
2. Отправить тестовую заявку из каждой формы: «Фінмодель», финальная, квиз, попап апартамента (кнопка «Планування» у формата).
3. На странице «Дякуємо» в Tag Assistant слева должно быть событие `generate_lead`. Во вкладке Tags — сработали GA4, Ads и Lead. Во вкладке Data Layer — все параметры.
4. Обновить «Дякуємо» — нового `generate_lead` быть не должно.
5. Быстрая проверка без GTM: на «Дякуємо» открыть консоль (F12) и ввести

   ```js
   dataLayer.filter(e => e.event === 'generate_lead')
   ```

   Должна быть одна запись.
6. Проверить в отчётах: GA4 → DebugView, Meta → Events Manager → Test Events.
7. Тестовые заявки уходят в CRM и Telegram как настоящие. Предупредите отдел продаж или потом удалите их в CRM.
8. После проверки — **Submit / Publish** контейнера.

## 7. Юридическое

В заявке телефон и email уходят в Google и Meta. Это должно быть указано в политике конфиденциальности сайта: какие данные, кому и зачем. Вопрос передан клиенту. Пока текст политики не обновлён, желательно не публиковать теги с `user_data`.
