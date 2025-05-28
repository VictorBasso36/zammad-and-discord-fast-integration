import express from "express";
import type MessageResponse from "../interfaces/MessageResponse";
import type { Request, Response } from "express";

const router = express.Router();

router.get<{}, MessageResponse>("/discord", (req, res) => {
  res.json({
    message: "API - Discord Webhook Integration",
  });
});

router.post<{}, MessageResponse, any>(
  "/discord",
  async (req: Request, res: Response) => {
    const body = req.body;

    // URL do webhook hardcoded como solicitado
    const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || "";

    try {
      // Extrair informações do ticket do Zammad (com fallbacks para dados vazios)
      const ticket = body?.ticket || {};
      const customer = ticket?.customer || {};
      const organization = ticket?.organization || {};
      const owner = ticket?.owner || {};

      // Determinar cor baseada no status
      const getStatusColor = (state: string) => {
        switch (state?.toLowerCase()) {
          case "open":
          case "new":
            return 0x00ff00; // Verde
          case "closed":
            return 0xff0000; // Vermelho
          case "pending":
            return 0xffff00; // Amarelo
          default:
            return 0x808080; // Cinza para desconhecido
        }
      };

      // Formatear nome completo do cliente
      const getCustomerName = () => {
        const firstName = customer?.firstname || "";
        const lastName = customer?.lastname || "";
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || "Cliente não identificado";
      };

      // Formatear nome completo do responsável
      const getOwnerName = () => {
        const firstName = owner?.firstname || "";
        const lastName = owner?.lastname || "";
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || "Não atribuído";
      };

      // Formatear data
      const formatDate = (dateString: string) => {
        if (!dateString) return "Data não disponível";
        try {
          return new Date(dateString).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch {
          return "Data inválida";
        }
      };

      // Mensagem para o Discord (sempre será enviada)
      const discordMessage = {
        username: "Zammad", // Nome do bot no Discord
        avatar_url: "https://zammad.org/assets/images/logo.png", // Logo do Zammad (opcional)
        embeds: [
          {
            title: `🎫 Ticket #${ticket?.number || "Sem número"}`,
            description: ticket?.title || "Ticket sem título",
            color: getStatusColor(ticket?.state),
            fields: [
              {
                name: "👤 Cliente",
                value: getCustomerName(),
                inline: true,
              },
              {
                name: "📧 Email",
                value: customer?.email || "Email não informado",
                inline: true,
              },
              {
                name: "🏢 Organização",
                value: organization?.name || "Sem organização",
                inline: true,
              },
              {
                name: "👨‍💼 Responsável",
                value: getOwnerName(),
                inline: true,
              },
              {
                name: "📊 Status",
                value: ticket?.state || "Status desconhecido",
                inline: true,
              },
              {
                name: "⚡ Prioridade",
                value: ticket?.priority?.name || "Prioridade não definida",
                inline: true,
              },
              {
                name: "📅 Criado em",
                value: formatDate(ticket?.created_at),
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: "Sistema Zammad • Webhook Integration",
              icon_url: "https://zammad.org/assets/images/logo.png",
            },
          },
        ],
      };

      // Sempre tentar enviar para o Discord
      console.log("Enviando dados para Discord webhook...");

      const discordResponse = await fetch(DISCORD_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(discordMessage),
      });

      if (!discordResponse.ok) {
        const errorText = await discordResponse.text();
        console.error(
          `Discord webhook error: ${discordResponse.status} - ${errorText}`
        );

        // Mesmo com erro, retornar sucesso parcial
        return res.status(207).json({
          message: "Dados recebidos, mas houve erro ao enviar para Discord",
          error: `Discord webhook failed: ${discordResponse.status}`,
          ticket: {
            number: ticket?.number || "N/A",
            title: ticket?.title || "N/A",
            customer: getCustomerName(),
            status: ticket?.state || "N/A",
          },
        });
      }

      console.log("Mensagem enviada para Discord com sucesso!");

      // Resposta de sucesso
      res.json({
        message: "Ticket recebido e enviado para Discord com sucesso",
        discord_sent: true,
        ticket: {
          number: ticket?.number || "N/A",
          title: ticket?.title || "N/A",
          customer: getCustomerName(),
          status: ticket?.state || "N/A",
          created_at: formatDate(ticket?.created_at),
        },
      });
    } catch (error) {
      console.error("Erro ao processar webhook:", error);

      // Tentar enviar mensagem de erro para o Discord
      try {
        const errorMessage = {
          username: "Zammad",
          embeds: [
            {
              title: "⚠️ Erro no Webhook",
              description: "Houve um erro ao processar o webhook do Zammad",
              color: 0xff0000, // Vermelho
              fields: [
                {
                  name: "Erro",
                  value:
                    error instanceof Error
                      ? error.message
                      : "Erro desconhecido",
                  inline: false,
                },
                {
                  name: "Timestamp",
                  value: new Date().toLocaleString("pt-BR"),
                  inline: false,
                },
              ],
              footer: {
                text: "Sistema Zammad • Error Handler",
              },
            },
          ],
        };

        await fetch(DISCORD_WEBHOOK, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(errorMessage),
        });
      } catch (discordError) {
        console.error(
          "Erro ao enviar mensagem de erro para Discord:",
          discordError
        );
      }

      res.status(500).json({
        message: "Erro ao processar dados",
        error: error instanceof Error ? error.message : "Erro desconhecido",
        discord_attempted: true,
      });
    }
  }
);

export default router;
