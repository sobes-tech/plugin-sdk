/** @jsxImportSource react */
import { useEffect, useState } from "react";
import { renderPlugin, usePlugin } from "../../src/react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Heading,
  Input,
  MarkdownRenderer,
  Page,
  PageHeader,
  Pill,
  Row,
  Spinner,
  Stack,
  Text,
} from "../../src/components";
import type { MeetingSummary, PluginMessage, Screenshot, ScreenshotContent } from "../../src";

function timestamp(value: string, ru: boolean) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(ru ? "ru-RU" : "en-US", { dateStyle: "medium", timeStyle: "short" });
}

function Library() {
  const { meetings, app, locale, settings } = usePlugin();
  const ru = locale === "ru";
  const [query, setQuery] = useState("");
  const [cursors, setCursors] = useState(["0"]);
  const [items, setItems] = useState<MeetingSummary[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const cursor = cursors[cursors.length - 1];

  useEffect(() => {
    let active = true;

    setBusy(true);
    const timer = setTimeout(() => {
      meetings
        .list({ query, cursor, limit: 20 })
        .then((page) => {
          if (active) {
            setItems(page.items);
            setNext(page.nextCursor);
            setTotal(page.total);
            setError(false);
          }
        })
        .catch(() => {
          if (active) {
            setError(true);
          }
        })
        .finally(() => {
          if (active) {
            setBusy(false);
          }
        });
    }, 120);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [meetings, query, cursor, retry]);

  return (
    <Page>
      <PageHeader
        title={ru ? "Библиотека встреч" : "Meeting library"}
        description={
          ru
            ? "Откройте встречу, чтобы прочитать историю разговора."
            : "Open a meeting to read its conversation history."
        }
        actions={<Pill>{total}</Pill>}
      />
      <Input
        aria-label={ru ? "Поиск встреч" : "Search meetings"}
        placeholder={ru ? "Найти встречу…" : "Find a meeting…"}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setCursors(["0"]);
        }}
      />
      {busy ? (
        <Row>
          <Spinner />
          <Text muted>{ru ? "Загружаем встречи…" : "Loading meetings…"}</Text>
        </Row>
      ) : error ? (
        <EmptyState
          title={ru ? "Не удалось загрузить встречи" : "Could not load meetings"}
          actions={
            <Button onClick={() => setRetry((value) => value + 1)}>
              {ru ? "Повторить" : "Retry"}
            </Button>
          }
        />
      ) : !items.length ? (
        <EmptyState title={ru ? "Встречи не найдены" : "No meetings found"} />
      ) : (
        <Stack gap={8}>
          {items.map((meeting) => (
            <Card key={meeting.id}>
              <CardContent>
                <Row style={{ justifyContent: "space-between" }}>
                  <Stack gap={4}>
                    <Heading level={3}>
                      {meeting.title || (ru ? "Встреча без названия" : "Untitled meeting")}
                    </Heading>
                    {settings["show-dates"] !== false && (
                      <Text small muted>
                        {timestamp(meeting.createdAt, ru)}
                      </Text>
                    )}
                  </Stack>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void app.openPage("history", { meetingId: meeting.id });
                    }}
                  >
                    {ru ? "Открыть историю" : "Open history"}
                  </Button>
                </Row>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
      <Row>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || cursors.length < 2}
          onClick={() => setCursors((values) => values.slice(0, -1))}
        >
          {ru ? "Назад" : "Previous"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || !next}
          onClick={() => {
            if (next) {
              setCursors((values) => [...values, next]);
            }
          }}
        >
          {ru ? "Далее" : "Next"}
        </Button>
      </Row>
    </Page>
  );
}

function History() {
  const { meetings, app, locale, context, settings } = usePlugin();
  const ru = locale === "ru";
  const meetingId = new URLSearchParams(String(context.search ?? "")).get("meetingId");
  const [title, setTitle] = useState("");
  const [messages, setMessages] = useState<PluginMessage[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    if (!meetingId) {
      setBusy(false);
      setError(true);

      return;
    }

    setBusy(true);
    setError(false);
    Promise.all([meetings.get(meetingId), meetings.messages(meetingId)])
      .then(([meeting, values]) => {
        if (active) {
          setTitle(meeting.title);
          setMessages(values);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
        }
      })
      .finally(() => {
        if (active) {
          setBusy(false);
        }
      });

    return () => {
      active = false;
    };
  }, [meetings, meetingId, retry]);

  const filtered = messages.filter(
    (message) =>
      (settings["show-answers"] !== false || message.speaker !== "assistant") &&
      (!query || message.text.toLocaleLowerCase().includes(query.toLocaleLowerCase())),
  );
  const speaker = (value: string) =>
    value === "assistant"
      ? ru
        ? "Ассистент"
        : "Assistant"
      : value === "interviewer"
        ? ru
          ? "Собеседник"
          : "Interviewer"
        : ru
          ? "Вы"
          : "You";

  return (
    <Page>
      <Row>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void app.openPage("library");
          }}
        >
          ← {ru ? "Все встречи" : "All meetings"}
        </Button>
      </Row>
      <PageHeader
        title={title || (ru ? "История встречи" : "Meeting history")}
        description={
          ru
            ? "Сообщения и ответы в хронологическом порядке."
            : "Messages and answers in chronological order."
        }
        actions={<Pill>{filtered.length}</Pill>}
      />
      <Input
        aria-label={ru ? "Поиск в истории" : "Search history"}
        placeholder={ru ? "Найти в разговоре…" : "Find in conversation…"}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {busy ? (
        <Row>
          <Spinner />
          <Text muted>{ru ? "Загружаем историю…" : "Loading history…"}</Text>
        </Row>
      ) : error ? (
        <EmptyState
          title={ru ? "Не удалось открыть историю" : "Could not open history"}
          actions={
            <Button onClick={() => setRetry((value) => value + 1)}>
              {ru ? "Повторить" : "Retry"}
            </Button>
          }
        />
      ) : !filtered.length ? (
        <EmptyState title={ru ? "Сообщений нет" : "No messages"} />
      ) : (
        <Stack gap={12}>
          {[...filtered]
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map((message, index) => (
              <Card key={message.id ?? index}>
                <CardContent>
                  <Stack gap={10}>
                    <Row>
                      <Badge tone={message.speaker === "assistant" ? "info" : "neutral"}>
                        {speaker(message.speaker)}
                      </Badge>
                      {settings["show-dates"] !== false && (
                        <Text small muted>
                          {timestamp(message.createdAt, ru)}
                        </Text>
                      )}
                    </Row>
                    <MarkdownRenderer
                      content={message.text}
                      answerHighlights={message.speaker === "assistant"}
                    />
                  </Stack>
                </CardContent>
              </Card>
            ))}
        </Stack>
      )}
    </Page>
  );
}

function Gallery() {
  const { screenshots, context, locale } = usePlugin();
  const ru = locale === "ru";
  const meetingId = typeof context.meetingId === "string" ? context.meetingId : "";
  const [items, setItems] = useState<Screenshot[]>([]);
  const [selected, setSelected] = useState("");
  const [image, setImage] = useState<ScreenshotContent | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    if (!meetingId) {
      return;
    }

    screenshots
      .list(meetingId)
      .then((values) => {
        if (active) {
          setItems(values);
          setSelected(values[0]?.id ?? "");
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [screenshots, meetingId]);

  useEffect(() => {
    let active = true;

    if (!selected) {
      return;
    }

    setImage(null);
    screenshots
      .get(meetingId, selected)
      .then((value) => {
        if (active) {
          setImage(value);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [screenshots, meetingId, selected]);

  return (
    <Stack gap={12}>
      <Row>
        {items.map((item, index) => (
          <Button
            size="sm"
            variant={selected === item.id ? "secondary" : "outline"}
            key={item.id}
            onClick={() => setSelected(item.id)}
          >
            {index + 1}
          </Button>
        ))}
      </Row>
      {error ? (
        <Text>{ru ? "Не удалось открыть скриншоты" : "Could not load screenshots"}</Text>
      ) : image ? (
        <img
          src={image.dataUrl}
          alt={ru ? "Скриншот встречи" : "Meeting screenshot"}
          style={{ maxWidth: "100%", maxHeight: 500, objectFit: "contain", borderRadius: 8 }}
        />
      ) : (
        <Text muted>
          {items.length
            ? ru
              ? "Загрузка…"
              : "Loading…"
            : ru
              ? "Нет скриншотов"
              : "No screenshots"}
        </Text>
      )}
    </Stack>
  );
}

renderPlugin({ library: Library, history: History, gallery: Gallery });
