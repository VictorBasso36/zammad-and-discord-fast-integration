import express from "express";
import MessageResponse from "../interfaces/MessageResponse";
import { Request, Response } from "express";

const router = express.Router();

router.get<{}, MessageResponse>("/discord", (req, res) => {
  res.json({
    message: "API - Hello World",
  });
});

router.post<{}, MessageResponse, any>(
  "/discord",
  async (req: Request, res: Response) => {
    const body = req.body;
    const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

    try {
      if (!DISCORD_WEBHOOK) {
        return res.status(500).json({
          message: "Discord webhook URL not configured",
        });
      }

      // Extrair informações do ticket do Zammad
      const ticket = body.ticket;
      const customer = ticket?.customer;
      const organization = ticket?.organization;
      const owner = ticket?.owner;

      // Formatear mensagem para o Discord
      const discordMessage = {
        embeds: [
          {
            title: `🎫 Ticket #${ticket?.number || "N/A"}`,
            description: ticket?.title || "Sem título",
            color:
              ticket?.state === "open"
                ? 0x00ff00
                : ticket?.state === "closed"
                ? 0xff0000
                : 0xffff00,
            fields: [
              {
                name: "👤 Cliente",
                value:
                  `${customer?.firstname || ""} ${
                    customer?.lastname || ""
                  }`.trim() || "N/A",
                inline: true,
              },
              {
                name: "📧 Email",
                value: customer?.email || "N/A",
                inline: true,
              },
              {
                name: "🏢 Organização",
                value: organization?.name || "N/A",
                inline: true,
              },
              {
                name: "👨‍💼 Responsável",
                value:
                  `${owner?.firstname || ""} ${owner?.lastname || ""}`.trim() ||
                  "N/A",
                inline: true,
              },
              {
                name: "📊 Status",
                value: ticket?.state || "N/A",
                inline: true,
              },
              {
                name: "⚡ Prioridade",
                value: ticket?.priority?.name || "N/A",
                inline: true,
              },
              {
                name: "📅 Criado em",
                value: ticket?.created_at
                  ? new Date(ticket.created_at).toLocaleString("pt-BR")
                  : "N/A",
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: "Zammad Webhook",
            },
          },
        ],
      };

      // Enviar dados para o Discord webhook
      const discordResponse = await fetch(DISCORD_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(discordMessage),
      });

      if (!discordResponse.ok) {
        const errorText = await discordResponse.text();
        throw new Error(
          `Discord webhook failed: ${discordResponse.status} - ${errorText}`
        );
      }

      res.json({
        message: "Ticket data received and sent to Discord successfully",
        ticket: {
          number: ticket?.number,
          title: ticket?.title,
          customer: `${customer?.firstname || ""} ${
            customer?.lastname || ""
          }`.trim(),
          status: ticket?.state,
        },
      });
    } catch (error) {
      console.error("Error sending to Discord webhook:", error);
      res.status(500).json({
        message: "Error sending data to Discord",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;
