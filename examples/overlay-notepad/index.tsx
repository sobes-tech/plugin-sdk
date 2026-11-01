/** @jsxImportSource react */
import { useEffect, useRef, useState } from "react";
import { renderPlugin, usePlugin } from "../../src/react";
import { Button, Field, Pill, Row, Stack, Text, Textarea } from "../../src/components";

function Notepad() {
  const { overlay, storage, locale, context, settings } = usePlugin();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const edited = useRef(false);
  const ru = locale === "ru";
  const storageKey =
    typeof context.messageId === "string" ? "message:" + context.messageId : "scratch";

  useEffect(() => {
    let active = true;

    edited.current = false;
    setText("");
    overlay
      .context()
      .then((value) => {
        if (active) {
          setTitle(value.title);
        }
      })
      .catch(() => {});

    storage
      .get<string>(storageKey)
      .then((value) => {
        if (active && !edited.current) {
          setText(value ?? "");
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [overlay, storage, context.meetingId, storageKey]);

  return (
    <Stack gap={12}>
      {settings["show-meeting-title"] !== false && (
        <Row>
          <Pill tone="info">{ru ? "Активная встреча" : "Active meeting"}</Pill>
          <Text small muted>
            {title}
          </Text>
        </Row>
      )}
      <Field
        label={
          typeof settings["note-label"] === "string" && settings["note-label"].trim()
            ? settings["note-label"]
            : ru
              ? "Заметка"
              : "Scratch note"
        }
      >
        <Textarea
          value={text}
          onChange={(event) => {
            edited.current = true;
            setText(event.target.value);
          }}
          onBlur={() => {
            if (edited.current) {
              void storage.set(storageKey, text).catch(() => {});
            }
          }}
        />
      </Field>
      <Row>
        <Button
          size="sm"
          disabled={!text.trim()}
          busy={busy}
          onClick={async () => {
            setBusy(true);

            try {
              await overlay.insertText(text);
              setMessage(ru ? "Добавлено в черновик" : "Added to draft");
            } catch {
              setMessage(ru ? "Не удалось вставить текст" : "Could not insert text");
            } finally {
              setBusy(false);
            }
          }}
        >
          {ru ? "Вставить в черновик" : "Insert into draft"}
        </Button>
        <Text small role="status">
          {message}
        </Text>
      </Row>
    </Stack>
  );
}

renderPlugin({ notepad: Notepad, "message-note": Notepad });
