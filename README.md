# Hotline Lite

A simple, privacy-first Twilio-based hotline. Key features include:
* multilingual support
* minimal logging
* web-based admin interface for managing operators, blocklists, languages, and wait messages
* ability to accept calls from systems that impose an initial menu before connecting the caller 
* _[alpha]_ integration with Signal for audio and text message delivery 

## Preparation

* Create [a Twilio account](https://twilio.com)
  * Make a note of your twilio account SID and auth token
* Create a shift calendar for hotline operators (optional)
  * Make a note of the url to the .ics feed
  * _[Tuta](https://tuta.com/calendar) is a free, secure option if you prefer not to use Google_
* Collect the phone numbers, aliases, and working languages of your operator team
* Collect the phone numbers and key sequences required to connect with any known callers

## Setup

1. Install the [Twilio CLI](https://www.twilio.com/docs/twilio-cli/getting-started/install)
2. Clone this repo: `gh repo clone thandal/hotline-lite`
3. Run the setup script: `./setup_hotline.sh`

The setup script provisions the phone number, TaskRouter workspace/workflow, and
admin password, then deploys the service. Everything else (operators, languages,
the blocklist, the shift calendar, and special call handling) is configured from
the admin dashboard after deployment. The link to the admin dashboard is provided
in the deployment process.

## Operation

### Caller Experience
When a Caller reaches the hotline, they will be greeted in the hotline's languages and asked to select their desired language by pressing a number. 
They will then be placed in a wait queue while the system finds an available operator.
They will periodically hear updates while waiting. If voicemail is enabled, they will have the option to leave a message.
If no operator on call speaks their chosen language, the caller is told so and given the option to leave a message (if voicemail is enabled) or select a second language.

### Operator Experience
When a Caller is added to the wait queue, active Operators (called Workers in the Twilio task scheduling system) who speak the Caller's selected language will receive a call from the hotline number.
They will hear the Pre-Call greeting menu with the option to accept the Call.
If they do not accept the Call, the Call will be returned to the queue to find another Operator.

Once a Caller and Operator are connected, they can talk!

When the Caller hangs up, or the Operator presses the `*` key to end the call, the Operator will have the Post-Call options to:
  * Hear the Caller's number
  * Add the Caller's number to the blocklist
  * Call the Caller back

Once the Operator hangs up, the Call is completed, and the Operator may receive the next Call.

### Admin Interface
The hotline includes a password-protected web admin interface for managing operators, blocklists, and supported languages. After deployment, access it at your Twilio Serverless URL's `/admin.html` endpoint.

The admin password is set during initial setup (via `ADMIN_PASSWORD` in the environment variables). Authentication uses HMAC-SHA1 tokens stored in the browser's session storage.

From the admin dashboard you can manage:
  * **Operators** -- View, add, edit, and remove operators (with name, phone number, and language support)
  * **Blocklist** -- Add or remove blocked phone numbers
  * **Languages** -- Add or remove supported languages for the caller greeting
  * **Special Call Handling** -- Define key sequences to auto-accept collect-style calls from specific numbers, and optionally restrict the hotline to accept calls only from those numbers. Each number can also have a name, which operators hear before accepting the call, and a language, which skips the language menu for that number

All data is stored securely in Twilio Serverless environment variables.

### Worker Registry
Manage your registry of workers/operators from the admin dashboard (the **Operators** panel), where you can view, add, edit, and remove operators.

### Worker Scheduling
Workers' shifts on the hotline are defined using a shared calendar.
Google and Tuta are two free options, but it doesn't matter what platform you use.
Workers may identify themselves using whatever name they wish, but it should correspond to a name that is linked to their number in the Worker Registry.
They do not need to list their phone number in the calendar.

Operators can sign up to be a backup operator by putting the word "backup" or "secondary" in the event location field for their shift.

Operator shift registries are stored securely in Twilio Serverless environment variables.

If no shared calendar is provided, all Operators are considered active.

### Blocklist
Manage the blocklist from the admin dashboard (the **Blocklist** panel). Operators can also add a caller's number to the blocklist at the end of a call. When messaging is enabled, text messages from numbers on the blocklist will not be forwarded to the hotline inbox.

## Supported Languages

The hotline can be configured with up to 9 active languages at a time. The hotline currently supports the following languages:

- Arabic
- English
- French
- Mandarin
- Portuguese
- Russian
- Spanish
- Ukrainian
- Vietnamese

Each language's phone messages are in `twilio-hotline/assets/messages/<code>.private.json`.
To add a language, copy `en.private.json`, translate every message, and add the language's
locale and voice to `langMap` in `twilio-hotline/assets/language.private.js`. A language is
offered only when its file has every message the English file has; the admin dashboard lists
the supported languages and refuses any other.

To provide full support for a language, Twilio must also have a satisfactory text-to-speech engine 
for the language in its [voice library](https://www.twilio.com/docs/voice/twiml/say/text-speech#text-to-speech-voices).

## Cost

The hotline has been developed by volunteers. However, it is not free to run.
Deploying and operating this hotline will cost you $1 per month + ~$0.02 per inbound minute.
These fees are managed by and payable to Twilio.

## Sending messages

In order to send text messages through the hotline, Twilio requires you to submit additional information through their developer console. You must first file a [Compliance Profile](https://1console.twilio.com/us1/develop/trusthub/compliance-profiles/primary), then take additional steps if you wish to send and receive WhatsApp messages.

### Required: Compliance Profile

A Primary Compliance Profile is required in order to send messages in the United States using the Twilio platform. Twilio documents <a href="https://www.twilio.com/docs/trust-hub/profiles/primary-compliance-profiles">this process</a> on their website.

### _Optional: WhatsApp Messaging Service_

In order to enable WhatsApp messaging, you must first create a <a href="https://1console.twilio.com/us1/develop/senders-hub/list/whatsapp">WhatsApp Sender</a> for your hotline number. In this process, you will need to link a WhatsApp Business Account. Twilio provides robust <a href="https://www.twilio.com/docs/whatsapp/self-sign-up#setting-up-your-twilio-phone-number-to-receive-the-verification-code-via-email-using-voicemail-transcription">documentation</a> of this process on their website.

Once you have created a WhatsApp Sender for the number, you must also create a <a href="https://1console.twilio.com/us1/develop/messaging/messaging-services">Messaging Service</a>. Under the "Senders" tab, add only the WhatsApp Sender to this Messaging Service. Under the "Settings" tab, ensure that the Messaging Service "defers to the sender's webhook" for inbound messages.

## Features under consideration

 - [ ] Support for additional languages
 - [ ] Allow operators to place outbound calls
 - [ ] Allow operators to respond to incoming text messages
 - [ ] Allow operator shift calendar to be enabled or disabled by language
 - [ ] Move [default Twilio data residency](https://www.twilio.com/docs/global-infrastructure) to the EU

### Language Support Pipeline

| Language      	| Messages 	| Text-to-Speech Engine 	| Supported     	|
|----------------	|:---------:|:-----------------------:|:---------------:|
| Arabic         	| ✅ | ✅ | ✅ |
| English        	| ✅ | ✅ | ✅ |
| French         	| ✅ | ✅ | ✅ |
| Mandarin       	| ✅ | ✅ | ✅ |
| Portuguese     	| ✅ | ✅ | ✅ |
| Russian        	| ✅ | ✅ | ✅ |
| Spanish        	| ✅ | ✅ | ✅ |
| Ukrainian      	| ✅ | ✅ | ✅ |
| Vietnamese     	| ✅ | ✅ | ✅ |
| Dari           	| ✅ | ❌ | ❌ |
| Farsi          	| ✅ | ❌ | ❌ |
| Haitian Creole 	| ✅ | ❌ | ❌ |
| Tigrinya       	| ✅ | ❌ | ❌ |
| Amharic        	| ✅ | ❌ | ❌ |
| Nepali         	| ✅ | ❌ | ❌ |
| Swahili        	| ❌ | ❌ | ❌ |
| Kinyarwanda    	| ❌ | ❌ | ❌ |
| Kurdish        	| ❌ | ❌ | ❌ |

## Development notes

Move to the root folder of the service to use Twilio's Serverless Development Toolkit: `cd twilio-hotline`

#### Commands

* Install Serverless Toolkit
`twilio plugins:install @twilio-labs/plugin-serverless`

* Local testing
`twilio serverless:dev`  _(or :run, or :start)_

* Deploy
`twilio serverless:deploy`

* List deployments _(get SID from here)_
`twilio serverless:list`

* Logs _(with optional --tail)_
`twilio serverless:logs --service-sid ZS000... --tail`

* Remove a service
`twilio api:serverless:v1:services:remove --sid ZS000...`

* Remove a build
`twilio api:serverless:v1:services:builds:remove --service-sid ZS000... --sid ZB000...`

* Remove a function
`twilio api:serverless:v1:services:functions:remove --service-sid ZS000... --sid ZH000...`
