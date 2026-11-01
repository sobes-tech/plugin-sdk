import { definePlugin, type JsonObject } from "../../src";
import { Button, Card, Input, Text, TextArea } from "../../src/ui";

definePlugin({
  views: {
    async form(ctx) {
      const input = ctx.input as JsonObject | null;
      const state: JsonObject = { name: "", content: "", ...ctx.state };

      if (input?.action === "name") {
        state.name = String(input.value ?? "");
      }

      if (input?.action === "content") {
        state.content = String(input.value ?? "");
      }

      if (input?.action === "save" && String(state.name).trim()) {
        await ctx.notes.create({ name: String(state.name), content: String(state.content) });
        state.name = "";
        state.content = "";
        state.saved = true;
      }

      const ru = ctx.locale === "ru";

      return {
        title: ru ? "Быстрая заметка" : "Quick note",
        state,
        blocks: [
          <Card title={ru ? "Быстрая заметка" : "Quick note"}>
            <Input label={ru ? "Название" : "Title"} value={state.name} action="name" />
            <TextArea label={ru ? "Текст" : "Content"} value={state.content} action="content" />
            <Button action="save" disabled={!String(state.name).trim()}>
              {ru ? "Сохранить" : "Save"}
            </Button>
            {state.saved && <Text>{ru ? "Заметка сохранена" : "Note saved"}</Text>}
          </Card>,
        ],
      };
    },
  },
});
