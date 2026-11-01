import { definePlugin } from "../../src";

definePlugin({
  commands: {
    async export(context) {
      const meeting = await context.meeting.getSelected();
      const messages = meeting.messages.filter(
        (message) => context.settings["include-answers"] || message.speaker !== "assistant",
      );
      const title = meeting.title.replace(/[\r\n]+/g, " ");
      const lines = messages.map((message) => {
        const speaker =
          message.speaker === "assistant"
            ? "Copilot"
            : message.speaker === "interviewer"
              ? context.locale === "ru"
                ? "Собеседник"
                : "Interviewer"
              : context.locale === "ru"
                ? "Вы"
                : "You";

        return `## ${speaker}\n\n${message.text}`;
      });

      await context.files.exportText({
        filename: `meeting-${meeting.id.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 80) || "export"}.md`,
        text: `# ${title}\n\n${meeting.createdAt}\n\n${lines.join("\n\n")}\n`,
      });
    },
  },
});
