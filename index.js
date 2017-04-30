"use strict";

require("./token");
require("./settings");

const Telegraf = require("telegraf");

const Utils = require("utils");

const ListeEpicerieBot = require("listeEpicerieBot");
const ListeEpicerieBridge = require("listeEpicerieBridge");

const telegraf = new Telegraf(process.env.BOT_TOKEN , {telegram: {agent: null, webhookReply: true}});

telegraf.telegram.getMe().then((botInfo) =>
  {
    telegraf.options.username = botInfo.username;
  });

function getSessionKey(context)
{
  if (context.chat)
  {
    return context.chat.id;
  }
  else
  {
    throw "cannot get session key from context";
  }
};

function initTelegraf(mongoSession)
{
  if (typeof mongoSession !== "undefined")
  {
    telegraf.use(mongoSession.middleware);
  }
  else
  {
    //fake persistency
    telegraf.use(Telegraf.memorySession({ "sessionName": "sessionPersistent", "getSessionKey": getSessionKey }));
  }

  telegraf.use(Telegraf.memorySession({ "getSessionKey": getSessionKey }));

  telegraf.use((context, next) =>
    {
      if (!context.session.storage)
      {
        Object.assign(context.session, Utils.createSession(context.sessionPersistent));
      }
      return next();
    });

  telegraf.command("/start", ListeEpicerieBridge.commands.start);
  telegraf.command("/commencer", ListeEpicerieBridge.commands.start);
  telegraf.command("/ajouter", ListeEpicerieBridge.commands.add);
  telegraf.command("/ajouter_categorie", ListeEpicerieBridge.commands.addCategories);
  telegraf.command("/liste", ListeEpicerieBridge.commands.list);
  telegraf.command("/message_maitre", ListeEpicerieBridge.commands.masterMessage);
  telegraf.command("/retirer", ListeEpicerieBridge.commands.removeItems);

  telegraf.on("callback_query", (context, next) =>
    {
      try
      {
        context.session.chatId = context.update.callback_query.message.chat.id;
        context.session.list.messageId = context.update.callback_query.message.message_id;
        Object.assign(context.sessionPersistent, context.session);
      }
      catch (exception) {}
      return next();
    });

  telegraf.on("text", (context) =>
    {
      if (ListeEpicerieBot.routeAction(context.session, context.message.text))
      {
        ListeEpicerieBridge.actions.listRefesh(context);
      }
    });

  telegraf.on("edited_message", (context) =>
    {
      var isMasterMessage = false;

      try
      {
        isMasterMessage = context.update.edited_message.message_id === context.session.masterMessage.id
      }
      catch (exception) {}

      if (isMasterMessage)
      {
        if (ListeEpicerieBot.removeItems(context.session, context.session.masterMessage.text))
        {
          ListeEpicerieBot.add(context.session, context.update.edited_message.text);

          context.session.message.callbackButtons = ListeEpicerieBridge.markups.listCallbackButtons;

          context.tg.callApi(
            "editMessageText"
            , Utils.createMessageList(
                context.session
                , ListeEpicerieBot.list(context.session)
                , Markup.inlineKeyboard(context.session.message.callbackButtons).resize().extra()));
        }

        context.session.masterMessage.text = context.update.edited_message.text;

        Object.assign(context.sessionPersistent, context.session);
      }
    });

  telegraf.action(/^\s*\/add_callback/, ListeEpicerieBridge.actions.add);
  telegraf.action(/^\s*\/addCategories_callback/, ListeEpicerieBridge.actions.addCategories);
  telegraf.action(/^\s*\/categorize_callback/, ListeEpicerieBridge.actions.categorize);
  telegraf.action(/^\s*\/categorizeConfirm_callback/, ListeEpicerieBridge.actions.categorizeConfirm);
  telegraf.action(/^\s*\/categorizeDisplayCategories_callback/, ListeEpicerieBridge.actions.categorizeDisplayCategories);
  telegraf.action(/^\s*\/categorizeRefresh_callback/, ListeEpicerieBridge.actions.categorizeRefresh);
  telegraf.action(/^\s*\/categorizeSelect_callback/, ListeEpicerieBridge.actions.categorizeSelect);
  telegraf.action(/^\s*\/categorizeSelectCancel_callback/, ListeEpicerieBridge.actions.categorizeSelectCancel);
  telegraf.action(/^\s*\/cancel_callback/, ListeEpicerieBridge.actions.cancel);
  telegraf.action(/^\s*\/listRefesh_callback/, ListeEpicerieBridge.actions.listRefesh);
  telegraf.action(/^\s*\/removeCategories_callback/, ListeEpicerieBridge.actions.removeCategories);
  telegraf.action(/^\s*\/removeCategoriesConfirm_callback/, ListeEpicerieBridge.actions.removeCategoriesConfirm);
  telegraf.action(/^\s*\/removeCategory_callback/, ListeEpicerieBridge.actions.removeCategory);
  telegraf.action(/^\s*\/removeCategoryCancel_callback/, ListeEpicerieBridge.actions.removeCategoryCancel);
  telegraf.action(/^\s*\/removeItems_callback/, ListeEpicerieBridge.actions.removeItems);
  telegraf.action(/^\s*\/removeItemsConfirm_callback/, ListeEpicerieBridge.actions.removeItemsConfirm);
  telegraf.action(/^\s*\/removeItem_callback/, ListeEpicerieBridge.actions.removeItem);
  telegraf.action(/^\s*\/removeItemCancel_callback/, ListeEpicerieBridge.actions.removeItemCancel);

  telegraf.startPolling();
}

if (process.env.USE_MONGO)
{
  const { MongoClient } = require('mongodb');
  const MongoSession = require('telegraf-session-mongo');

  MongoClient.connect(process.env.MONGO_URL).then((client) =>
    {
      const mongoSession = new MongoSession(
        client
        , {
            "property": "sessionPersistent"
            , "collection": "sessionsPersistent"
            , "getSessionKey": getSessionKey
          });

      mongoSession.setup().then(() =>
        {
          initTelegraf(mongoSession);
        });
    });
}
else
{
  initTelegraf();
}
