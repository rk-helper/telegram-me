#!/usr/bin/env bun

/**
 * Telegram Me MCP Server
 *
 * A stdio-based MCP server that lets Claude message you on Telegram.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MessageManager, loadMessageManagerConfig } from './message-manager.js';

async function main() {
  // Load configuration
  let config;
  try {
    config = loadMessageManagerConfig();
  } catch (error) {
    console.error('Configuration error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Create message manager
  const messageManager = new MessageManager(config);
  await messageManager.initialize();

  // Create stdio MCP server
  const mcpServer = new Server(
    { name: 'telegram-me', version: '2.0.0' },
    { capabilities: { tools: {} } }
  );

  // List available tools
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'send_message',
          description: 'Send a message to the user via Telegram and wait for their response.',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'The message to send to the user. Be clear and conversational.',
              },
            },
            required: ['message'],
          },
        },
        {
          name: 'continue_conversation',
          description: 'Continue an active conversation with a follow-up message.',
          inputSchema: {
            type: 'object',
            properties: {
              conversation_id: { type: 'string', description: 'The conversation ID from send_message' },
              message: { type: 'string', description: 'Your follow-up message' },
            },
            required: ['conversation_id', 'message'],
          },
        },
        {
          name: 'notify_user',
          description: 'Send a notification message without waiting for a response. Use this for status updates or acknowledgments.',
          inputSchema: {
            type: 'object',
            properties: {
              conversation_id: { type: 'string', description: 'The conversation ID from send_message' },
              message: { type: 'string', description: 'The notification message' },
            },
            required: ['conversation_id', 'message'],
          },
        },
        {
          name: 'end_conversation',
          description: 'End an active conversation with a closing message.',
          inputSchema: {
            type: 'object',
            properties: {
              conversation_id: { type: 'string', description: 'The conversation ID from send_message' },
              message: { type: 'string', description: 'Your closing message' },
            },
            required: ['conversation_id', 'message'],
          },
        },
      ],
    };
  });

  // Handle tool calls
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      if (request.params.name === 'send_message') {
        const { message } = request.params.arguments as { message: string };
        const result = await messageManager.sendMessage(message);

        return {
          content: [{
            type: 'text',
            text: `Message sent successfully.\n\nConversation ID: ${result.conversationId}\n\nUser's response:\n${result.response}\n\nUse continue_conversation for follow-ups or end_conversation to finish.`,
          }],
        };
      }

      if (request.params.name === 'continue_conversation') {
        const { conversation_id, message } = request.params.arguments as { conversation_id: string; message: string };
        const response = await messageManager.continueConversation(conversation_id, message);

        return {
          content: [{ type: 'text', text: `User's response:\n${response}` }],
        };
      }

      if (request.params.name === 'notify_user') {
        const { conversation_id, message } = request.params.arguments as { conversation_id: string; message: string };
        await messageManager.notify(conversation_id, message);

        return {
          content: [{ type: 'text', text: `Notification sent: "${message}"` }],
        };
      }

      if (request.params.name === 'end_conversation') {
        const { conversation_id, message } = request.params.arguments as { conversation_id: string; message: string };
        const { durationSeconds } = await messageManager.endConversation(conversation_id, message);

        return {
          content: [{ type: 'text', text: `Conversation ended. Duration: ${durationSeconds}s` }],
        };
      }

      throw new Error(`Unknown tool: ${request.params.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  });

  // Connect MCP server via stdio
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  console.error('');
  console.error('Telegram Me MCP server ready');
  console.error('');

  // Graceful shutdown
  const shutdown = async () => {
    console.error('\nShutting down...');
    messageManager.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
