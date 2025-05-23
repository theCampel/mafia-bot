# Mafia Bot:
WhatsApp Mafia Bot that uses [WhatsApp JS Web API](https://github.com/pedroslopez/whatsapp-web.js) to extract messages from WhatsApp groups and store them in a Supabase database. Eventually, the goal is to have a @askPerplexity-like bot that can answer questions and be generally useful within the gc (as well as DM people [that have subscribed] summaries of what's happened in the gc recently / notify them of anything they may find interesting). I'd also like a dashboard that can plug into the website - that would be cool.

## So Far:
- [x] Have a working bot that can read incoming messages, extract messages from arbitrary groups etc.
- [x] Extract messages from WhatsApp groups and store them in a Supabase database
- [ ] Incorporate syncing of new messages into the database
- [ ] Incorporate a search feature that looks for relevant messages.
- [ ] Fill out the rest of this `README.md` lol

## Random Design Rationale:
I'm going to use this as a scratchpad, so if anyone's coming across this, I'm sorry. 
- For setup, populate a Supabase DB with all of the messages until this point (one-time).
- From there, sync all messages since most recent message in the DB. 
  - At this point, you might naturally ask yourself: _"Why didn't you just build out the syncing first, and then run it on an empty DB?"..._
- Anyways, the next natural question is _"Why use Supabase in the first place?"_. 
  - WwebJS is unreliable / slow. It can take a while to get every message. Figured a DB would be a good, quick, fast and cheap way of storing and retrieving them. 
- Regardless, when the bot is tagged in a message, decide which tools to use in an MCP like way. 
- For searching through messages, I'm considering:
  - Can vector search the DB, take the most relevent messages (and their surrounding messages)
  - Generate a search query and search the DB with that.
  - Pump it all into context. (`~100k` tokens across all chats * 0.15$ per 1M tokens = [$0.015 for EVERY SINGLE query](https://ai.google.dev/gemini-api/docs/pricing)) ([Click here if you want to help out 😉](https://buymeacoffee.com/leocamacho3))
- 


## Setup:
1. Clone the repository
2. Create a Supabase DB with the schema of below.
3. Fill out the `.env` file with the correct values.
4. Run `npm install` to install the dependencies
5. Run `npm run dev` to start the development server
6. Run `npm run prod` to start the production server


## Table: wa_um_messages
| Column               | Type        | Description                |
|----------------------|-------------|----------------------------|
| `id`                 | `text`      | Primary key (message.id._serialized) |
| `chat_id`            | `text`      | Group or individual chat ID (message.from) |
| `sender_id`          | `text`      | Sender ID (message.author or message.from) |
| `message_text`       | `text`      | Message content (body or caption) |
| `message_type`       | `text`      | Type of message ("chat", "image", "video", etc.) |
| `timestamp`          | `timestamptz` | Message timestamp |
| `quoted_message_id`  | `text`      | ID of quoted message (if any) |
| `has_media`          | `bool`      | Indicates if message contains media |

### Unicorn Farm Chat IDs:
```
{ id: '120363359504745590@g.us', name: 'Unicorn Farm' },
{ id: '120363419170859917@g.us', name: 'Unicorn Mafia' },
{ id: '120363401735030139@g.us', name: 'Hackathons' },
```
> 🚨 Note: As a way of practising writing prod-ready code, I wrote prod/dev npm scripts. 
> The dev script uses a gc I have with some friends. Hence Appleton Shaggers lol. 
> Also, I'm not sure how secure it is to publicly share the chat IDs, so sorry if it absolutely ruins the community.
