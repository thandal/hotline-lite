# Simple Hotline

A simple, privacy-first Twilio-based hotline. Key features:
* multilingual support
* web-based admin interface for managing operators, blocklists, and languages
* minimal logging
* [ALPHA] Signal notifications

## Preparation

* Create a twilio account: https://twilio.com
  * Make a note of your twilio account SID and auth token
* Create a shift calendar for hotline operators (optional)
  * Make a note of the url to the .ics feed
  * _[Tuta](https://tuta.com/calendar) is a free, secure option if you prefer not to use Google_
* Collect the phone numbers, aliases, and working languages of your operator team

## Setup

1. Install twilio CLI: https://www.twilio.com/docs/twilio-cli/getting-started/install
2. Clone this repo: `gh repo clone thandal/hotline-lite`
3. Run the setup script: `./setup_hotline.sh`

The setup script provisions the phone number, TaskRouter workspace/workflow, and
admin password, then deploys the service. Everything else -- operators, languages,
the blocklist, the shift calendar, and special call handling -- is configured from
the admin dashboard (`/admin.html`) after deployment.

## Operation

### Caller Experience
When a Caller reaches the hotline, they will be greeted in various languages and asked to select their desired language by pressing a number.
They will then be placed in a wait queue while the system finds an available operator.
They will periodically hear updates while waiting.

### Operator Experience
Operators (called Workers in the Twilio task scheduling system) will receive a call from the hotline number.
They will then have the Pre-Call options to press a number to accept the Call.
If they do not, the Call will be rejected and returned to the queue to find another Operator.

Once a Caller and Operator are connected, they can talk!

When the Caller hangs up, or the Operator presses *, the Operator will have the Post-Call options to
  * Hear the Caller's number
  * Add the Caller's number to the blocklist
  * Call the Caller back

Once the Operator hangs up, the Call is completed, and the Operator may receive the next Call.

### Worker Schedule
Workers set (or are given) shifts on the hotline using a shared calendar.
Google and Tuta are two free options, but it doesn't matter what platform you use.
Workers may identify themselves using whatever name they wish, but it should correspond to a name that is linked to their number in the Worker Registry.
They do not need to list their phone number in the calendar.

Operators can sign up to be a backup operator by putting the word "backup" or "secondary" in the event location field for their shift.

Operator shift registries are stored securely in Twilio Serverless environment variables.

### Worker Registry
Manage your registry of workers/operators from the admin dashboard (the **Operators** panel), where you can view, add, edit, and remove operators.

### Admin Interface
The hotline includes a password-protected web admin interface for managing operators, blocklists, and supported languages. After deployment, access it at your Twilio Serverless URL's `/admin.html` endpoint.

The admin password is set during initial setup (via `ADMIN_PASSWORD` in the environment variables). Authentication uses HMAC-SHA1 tokens stored in the browser's session storage.

From the admin dashboard you can:
  * **Operators** -- View, add, edit, and remove operators (with name, phone number, and language support)
  * **Blocklist** -- Add or remove blocked phone numbers
  * **Languages** -- Add or remove supported languages for the caller greeting
  * **Special Call Handling** -- Define key sequences to auto-accept collect-style calls from specific numbers, and optionally restrict the hotline to accept calls only from those numbers

All data is stored securely in Twilio Serverless environment variables.

### Blocklist
Manage the blocklist from the admin dashboard (the **Blocklist** panel). Operators can also add a caller's number to the blocklist at the end of a call.

## Cost

The hotline has been developed by volunteers. However, it is not free to run.
Deploying and operating this hotline will cost you $1 per month + ~$0.02 per inbound minute.
These fees are managed by and payable to Twilio.

## Sending Messages

In order to send text messages through the hotline, Twilio requires you to submit additional information through their developer console. You must first file a <a href="https://1console.twilio.com/us1/develop/trusthub/compliance-profiles/primary">Compliance Profile</a>, then take additional steps if you wish to send and receive WhatsApp messages.

### Required: Compliance Profile

A Primary Compliance Profile is required in order to send messages in the United States using the Twilio platform. Twilio documents <a href="https://www.twilio.com/docs/trust-hub/profiles/primary-compliance-profiles">this process</a> on their website.

### _Optional: WhatsApp Messaging Service_

In order to enable WhatsApp messaging, you must first create a <a href="https://1console.twilio.com/us1/develop/senders-hub/list/whatsapp">WhatsApp Sender</a> for your hotline number. In this process, you will need to link a WhatsApp Business Account. Twilio provides robust <a href="https://www.twilio.com/docs/whatsapp/self-sign-up#setting-up-your-twilio-phone-number-to-receive-the-verification-code-via-email-using-voicemail-transcription">documentation</a> of this process on their website.

Once you have created a WhatsApp Sender for the number, you must also create a <a href="https://1console.twilio.com/us1/develop/messaging/messaging-services">Messaging Service</a>. Under the "Senders" tab, add only the WhatsApp Sender to this Messaging Service. Under the "Settings" tab, ensure that the Messaging Service "defers to the sender's webhook" for inbound messages.

## Overview diagram

<img width="1426" height="859" alt="image" src="https://github.com/user-attachments/assets/34111b89-4565-4711-b548-09126cc16868" />

## Development notes for twilio-hotline

`cd twilio-hotline`

* Install Serverless Toolkit
`twilio plugins:install @twilio-labs/plugin-serverless`

* Local testing
`twilio serverless:dev`  (or :run, or :start)

* Deploy
`twilio serverless:deploy`

* List deployments (get SID from here)
`twilio serverless:list`

* LOGS (with --tail)!
`twilio serverless:logs --service-sid BLAH --tail`

Remove a service:
`twilio api:serverless:v1:services:remove --sid BLAH`

Remove a build:
`twilio api:serverless:v1:services:builds:remove --sid BLAH --service-sid BUILD_BLAH`

Remove a function:
`twilio api:serverless:v1:services:functions:remove --service-sid BLAH --sid FUNTION_BLAH`


## Features under consideration

 - [ ] Allow operators to place outbound calls
 - [ ] Allow known numbers to bypass the language menu
 - [ ] Move [default Twilio data residency](https://www.twilio.com/docs/global-infrastructure) to the EU
