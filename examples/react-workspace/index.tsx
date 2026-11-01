/** @jsxImportSource react */
import { useEffect, useState } from "react";
import { renderPlugin, usePlugin } from "../../src/react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  EmptyState,
  Field,
  Heading,
  Input,
  Page,
  PageHeader,
  Pill,
  Progress,
  Row,
  Select,
  Separator,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TogglePill,
} from "../../src/components";
import type { MeetingSummary, ScreenshotContent } from "../../src";
import "./style.css";

function QuickNote() {
  const { notes, locale, settings } = usePlugin();
  const ru = locale === "ru";
  const defaultName = typeof settings["note-title"] === "string" ? settings["note-title"] : "";
  const [name, setName] = useState(defaultName);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Card>
      <CardHeader>
        <Heading level={3}>{ru ? "Быстрая заметка" : "Quick note"}</Heading>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setStatus("");

            try {
              await notes.create({ name, content });
              setName(defaultName);
              setContent("");
              setStatus(ru ? "Сохранено" : "Saved");
            } catch {
              setStatus(ru ? "Не удалось сохранить" : "Could not save");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Stack gap={12}>
            <Field label={ru ? "Название" : "Title"}>
              <Input
                placeholder={ru ? "Название" : "Title"}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label={ru ? "Текст" : "Content"}>
              <Textarea
                placeholder={ru ? "Текст заметки" : "Note content"}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </Field>
            <Row>
              <Button type="submit" size="sm" busy={busy} disabled={!name.trim()}>
                {ru ? "Сохранить" : "Save"}
              </Button>
              <output role="status">{status}</output>
            </Row>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}

function Components() {
  const { locale } = usePlugin();
  const ru = locale === "ru";
  const [filter, setFilter] = useState(true);
  const [compact, setCompact] = useState(false);
  const [enabled, setEnabled] = useState(true);

  return (
    <Stack>
      <Card>
        <CardHeader>
          <Heading level={2}>{ru ? "Базовые компоненты" : "Basic components"}</Heading>
          <Text muted>
            {ru ? "Общие цвета, размеры и состояния." : "Shared colors, sizing and states."}
          </Text>
        </CardHeader>
        <CardContent>
          <Stack>
            <Row>
              <Pill>Default</Pill>
              <Pill tone="success">Success</Pill>
              <Pill tone="warning">Warning</Pill>
              <Pill tone="danger">Error</Pill>
              <Pill tone="info">Info</Pill>
              <Badge tone="accent">NEW</Badge>
            </Row>
            <Row>
              {filter && (
                <Pill onRemove={() => setFilter(false)} removeLabel="Remove filter">
                  Removable filter
                </Pill>
              )}
              <TogglePill selected={compact} onClick={() => setCompact((value) => !value)}>
                Compact mode
              </TogglePill>
            </Row>
            <Separator />
            <Row>
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button disabled>Disabled</Button>
            </Row>
            <Row>
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Notifications" />
              <Text>Notifications</Text>
              <label>
                <Checkbox defaultChecked /> Checkbox
              </label>
            </Row>
            <Field label="Category">
              <Select
                defaultValue="meetings"
                options={[
                  { value: "meetings", label: "Meetings" },
                  { value: "notes", label: "Notes" },
                ]}
              />
            </Field>
            <Progress value={65} label="Example progress" />
          </Stack>
        </CardContent>
      </Card>
      <EmptyState
        title={ru ? "Здесь появятся документы" : "Documents will appear here"}
        description={
          ru ? "Пустое состояние без лишних настроек." : "An empty state with useful defaults."
        }
        actions={<Button variant="outline">{ru ? "Создать документ" : "Create document"}</Button>}
      />
    </Stack>
  );
}

function Workspace() {
  const { meetings, screenshots, locale, settings } = usePlugin();
  const ru = locale === "ru";
  const [tab, setTab] = useState("meetings");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MeetingSummary[]>([]);
  const [selected, setSelected] = useState<MeetingSummary | null>(null);
  const [image, setImage] = useState<ScreenshotContent | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      meetings
        .list({ query, limit: 50 })
        .then((page) => {
          if (active) {
            setItems(page.items);
            setError("");
          }
        })
        .catch(() => {
          if (active) {
            setError(ru ? "Не удалось загрузить встречи" : "Could not load meetings");
          }
        });
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, meetings, ru]);

  useEffect(() => {
    let active = true;

    setImage(null);
    setImages([]);

    if (selected) {
      screenshots
        .list(selected.id)
        .then((list) => {
          if (active) {
            setImages(list.map((item) => item.id));
          }
        })
        .catch(() => {
          if (active) {
            setError(ru ? "Не удалось загрузить скриншоты" : "Could not load screenshots");
          }
        });
    }

    return () => {
      active = false;
    };
  }, [selected, screenshots, ru]);

  return (
    <Page>
      <PageHeader
        title={ru ? "Моё пространство" : "My workspace"}
        description={ru ? "Встречи, скриншоты и заметки." : "Meetings, screenshots and notes."}
        actions={<Pill tone="info">React</Pill>}
      />
      <Tabs
        value={tab}
        onValueChange={setTab}
        items={[
          {
            value: "meetings",
            label: ru ? "Встречи" : "Meetings",
            content: (
              <div className="workspace-columns">
                <Stack>
                  <Input
                    aria-label={ru ? "Поиск встреч" : "Search meetings"}
                    placeholder={ru ? "Поиск встреч…" : "Search meetings…"}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {error && <p role="alert">{error}</p>}
                  <div className="meetings">
                    {items.map((meeting) => (
                      <Button
                        key={meeting.id}
                        variant={selected?.id === meeting.id ? "secondary" : "ghost"}
                        onClick={() => setSelected(meeting)}
                      >
                        <strong>{meeting.title || (ru ? "Встреча" : "Meeting")}</strong>
                        <small>{meeting.createdAt}</small>
                      </Button>
                    ))}
                  </div>
                </Stack>
                <Stack>
                  <Heading level={2}>
                    {selected?.title || (ru ? "Скриншоты" : "Screenshots")}
                  </Heading>
                  <Row>
                    {images.map((id, index) => (
                      <Button
                        variant="outline"
                        size="sm"
                        key={id}
                        onClick={async () => {
                          try {
                            const result = await screenshots.get(selected!.id, id);

                            setImage(result);
                          } catch {
                            setError(
                              ru ? "Не удалось открыть скриншот" : "Could not open screenshot",
                            );
                          }
                        }}
                      >
                        {index + 1}
                      </Button>
                    ))}
                  </Row>
                  {image ? (
                    <img
                      className="workspace-image"
                      src={image.dataUrl}
                      alt={ru ? "Скриншот встречи" : "Meeting screenshot"}
                    />
                  ) : (
                    <Text muted>
                      {ru ? "Выберите встречу и скриншот." : "Choose a meeting and screenshot."}
                    </Text>
                  )}
                  {settings["show-quick-note"] !== false && <QuickNote />}
                </Stack>
              </div>
            ),
          },
          { value: "components", label: ru ? "Компоненты" : "Components", content: <Components /> },
        ]}
      />
    </Page>
  );
}

renderPlugin({ workspace: Workspace, "quick-note": QuickNote });
