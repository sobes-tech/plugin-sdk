/** @jsxImportSource react */
import { useState } from "react";
import { localized, type PluginSlot } from "../../src";
import { Button } from "../../src/components";
import { renderPlugin, usePlugin } from "../../src/react";
import { slotDescriptions, slotEntries } from "./manifest";
import "./style.css";

function SlotMarker({ slot }: { slot: PluginSlot }) {
  const { locale, theme, context } = usePlugin();
  const [clicks, setClicks] = useState(0);
  const ru = locale === "ru";
  const page = slot === "app.page";
  const contextEntries = Object.entries(context).filter(
    ([, value]) => value !== null && value !== undefined,
  );

  return (
    <main className="slot-marker" data-ui-slot={slot}>
      <header className="slot-marker-heading">
        <span className="slot-marker-status">{ru ? "Слот отрисован" : "Slot rendered"}</span>
        <span className="slot-marker-meta">React · {theme}</span>
      </header>
      <h1>{slot}</h1>
      <p>{localized(slotDescriptions[slot], locale)}</p>
      <div className="slot-marker-actions">
        <button type="button" onClick={() => setClicks((value) => value + 1)}>
          {ru ? "Проверить клик" : "Test click"}
        </button>
        <output aria-live="polite">
          {ru ? "Кликов" : "Clicks"}: {clicks}
        </output>
      </div>
      {contextEntries.length > 0 && (
        <details className="slot-marker-context">
          <summary>{ru ? "Контекст от хоста" : "Host context"}</summary>
          <dl>
            {contextEntries.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{typeof value === "string" ? value : JSON.stringify(value)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {page && (
        <section className="slot-marker-guide" aria-labelledby="slot-guide-title">
          <h2 id="slot-guide-title">
            {ru
              ? `Где найти все ${slotEntries.length} слотов`
              : `Where to find all ${slotEntries.length} slots`}
          </h2>
          <p>
            {ru
              ? "Откройте нужную страницу и нажмите на элемент «UI-слоты». ID слота виден в подсказке при наведении и внутри открытой панели. В оверлее проверьте видимость элементов в редакторе панели встречи и настройках сообщений."
              : "Open the relevant screen, then select the UI Slots control. Its tooltip and opened panel identify the slot. In the overlay, check control visibility in the Meeting Panel editor and message settings."}
          </p>
          <p>
            {ru
              ? "Это карта объявленных слотов, а не отчёт об их проверке. Слоты открываются на разных экранах. Счётчик хранится только в текущем представлении; плагин не читает данные через API и ничего не сохраняет."
              : "This is a map of declared slots, not a verification report. Slots open on different screens. The counter lives only in the current view; the plugin makes no data API calls and saves nothing."}
          </p>
          <ol>
            {slotEntries.map(([id, description]) => (
              <li key={id}>
                <code>{id}</code>
                <p>{localized(description, locale)}</p>
              </li>
            ))}
          </ol>
          <h2>{ru ? "Встроенные элементы" : "Inline controls"}</h2>
          <p>
            {ru
              ? "Значок питания — переключатель прямо на панели инструментов встречи. Плюс — обычная кнопка под сообщением; число нажатий указано в подсказке. Оба элемента работают без попапа и хранят состояние только в своём React-представлении."
              : "The power icon is a toggle directly in the meeting toolbar. The plus icon is an action button below a message; its tooltip tracks presses. Both work without a popup and keep state only in their own React view."}
          </p>
        </section>
      )}
    </main>
  );
}

function InlineToggle() {
  const { locale } = usePlugin();
  const [pressed, setPressed] = useState(false);
  const ru = locale === "ru";

  return (
    <div className="slot-inline-control">
      <Button
        size="sm"
        variant={pressed ? "secondary" : "ghost"}
        aria-pressed={pressed}
        aria-label={ru ? "Пример переключателя" : "Toggle example"}
        title={
          ru
            ? `Режим примера: ${pressed ? "включён" : "выключен"}`
            : `Example mode: ${pressed ? "on" : "off"}`
        }
        onClick={() => setPressed((value) => !value)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M12 2v10M6.4 5.6a8 8 0 1 0 11.2 0" />
        </svg>
      </Button>
    </div>
  );
}

function InlineAction() {
  const { locale } = usePlugin();
  const [clicks, setClicks] = useState(0);
  const ru = locale === "ru";

  return (
    <div className="slot-inline-control">
      <Button
        size="sm"
        variant="ghost"
        aria-label={ru ? "Пример действия" : "Action example"}
        title={ru ? `Нажатий: ${clicks}` : `Clicks: ${clicks}`}
        onClick={() => setClicks((value) => value + 1)}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Button>
    </div>
  );
}

renderPlugin({
  ...Object.fromEntries(slotEntries.map(([slot]) => [slot, () => <SlotMarker slot={slot} />])),
  "inline-toggle": InlineToggle,
  "inline-action": InlineAction,
});
