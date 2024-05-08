// modified from u/ihatebrooms on reddit's macro https://www.reddit.com/r/FoundryVTT/comments/195xinn/pf2e_change_armor_macro/

main();

async function main() {
  console.log("Executing macro: METAL CARAPACE");

  let actor = getSelectedActor();
  console.log(actor);
  if (!actor) {
    console.log("Exiting macro: METAL CARAPACE with error");
    return;
  }

  updateActorCriticalHook(actor);
  toggleArmor(actor);
  toggleShield(actor);
  console.log("Completed macro: METAL CARAPACE");
}

async function updateActorCriticalHook(actor) {
  const oldHookId = actor.flags.mcmacro && actor.flags.mcmacro.listenerId
    ? actor.flags.mcmacro.listenerId
    : null;
  if (oldHookId) {
    await removeActorListener(actor);
  }

  const hookId = Hooks.on("createChatMessage", (event) => processChatMessage(event, actor));
  await actor.update({
    "flags.mcmacro.listenerId": hookId
  });
}

function getSelectedActor() {
  let selectedTokens = canvas.tokens.controlled;

  if (selectedTokens.length !== 1) {
    // Display an error message if no tokens are selected or more than one token is selected
    ui.notifications.error("Please select exactly one token to use this macro.");
    return;
  }

  let actor = selectedTokens[0].actor;
  let metalCarapace = findFeatByName(actor, "Metal Carapace");
  if (!metalCarapace) {
    // Display an error message if the token does not have the "Metal Carapace" action
    ui.notifications.error("Macro requires the 'Metal Carapace' feat.");
    return;
  }

  return actor;
}

async function toggleShield(actor) {
  const shieldName = "Rusty Shield (MC)"
  console.log('Toggling Shield');

  let shield = actor.items.find(item => item.name == shieldName && item.system.quantity > 0
    && item.system.equipped.carryType == "held");
  if (shield) {
    console.log("Removing Shield");
    removeShield(actor);
    return;
  }

  shield = await game.items.find(item => item.name == "Steel Shield");
  if (!shield) {
    shield = await game.items.importFromCompendium(game.packs.get("pf2e.equipment-srd"), "Yr9yCuJiAlFh3QEB");
  }

  let heightenedX = Math.floor((parseInt(actor.level) - 1) / 3);

  console.log('Creating Shield');
  let eqShield = (await actor.createEmbeddedDocuments('Item', [shield.toObject()]))[0];
  await eqShield.update({
    "name": shieldName,
    "system.equipped.carryType": "held",
    "system.equipped.handsHeld": 1,
    "system.hardness": (eqShield.system.hardness + (heightenedX)),
    "system.hp.value": (eqShield.system.hp.value + (4 * heightenedX)),
    "system.hp.max": (eqShield.system.hp.max + (4 * heightenedX)),
    "system.hp.brokenThreshold": (eqShield.system.hp.brokenThreshold + (2 * heightenedX))
  });
  await addShieldBlockReaction(actor);

  Hooks.once('deleteCombat', () => { removeShield(actor, eqShield); });
}

function removeShield(actor) {
  const shieldName = "Rusty Shield (MC)"
  const shield = actor.items.find(item => item.name == shieldName && item.system.quantity > 0
    && item.system.equipped.carryType == "held");

  shield.delete();
  removeShieldBlockReaction(actor);
}

async function toggleArmor(actor) {
  const armorName = "Rusty Armor (MC)";
  console.log("Toggling Armor");

  let summonedArmor = actor.items.find(item => item.name == armorName && item.system.quantity > 0 && item.system.equipped.inSlot == true);
  let oldArmor = actor.items.find(item => item.type == 'armor' && item.name != armorName &&
    (item.system.equipped.inSlot == true || (item.flags.macros && item.flags.macros.originalArmor)));

  if (summonedArmor) {
    console.log('Restoring original armor');
    restoreArmor(actor);
    return;
  }

  let bestDef = await getBestDefense(actor);
  let adjVal = 3 + bestDef.value - actor.system.proficiencies.defenses.medium.value;

  let armor = await game.items.find(item => item.name == "Breastplate");
  if (!armor) {
    armor = await game.items.importFromCompendium(game.packs.get("pf2e.equipment-srd"), "r0ifJfoz8aqf0mwk");
  }

  console.log('Creating rusty armor');
  let mcArmor = (await actor.createEmbeddedDocuments('Item', [armor.toObject()]))[0];
  await mcArmor.update({
    "name": armorName,
    "system.acBonus": adjVal,
    "system.bulk.value": 2,
    "system.dexCap": 2,
    "system.strength": 2,
    "system.runes": oldArmor.system.runes,
    "system.equipped.inSlot": true,
    "system.equipped.invested": true
  });

  if (oldArmor) {
    await oldArmor.update({
      "system.equipped.inSlot": false,
      "flags.macros.originalArmor": true
    });
  }

  Hooks.once('deleteCombat', () => {
    mcArmor.delete();
    if (oldArmor) {
      oldArmor.update({
        "system.equipped.inSlot": true
      });
    }
  });
}

function restoreArmor(actor) {
  console.log("Restoring original armor");
  const armorName = "Rusty Armor (MC)";
  console.log("Toggling Armor");

  let summonedArmor = actor.items.find(item => item.name == armorName && item.system.quantity > 0 && item.system.equipped.inSlot == true);
  let oldArmor = actor.items.find(item => item.type == 'armor' && item.name != armorName &&
    (item.system.equipped.inSlot == true || (item.flags.macros && item.flags.macros.originalArmor)));

  if (summonedArmor) {
    summonedArmor.delete();
  }

  if (oldArmor) {
    oldArmor.update({
      "system.equipped.inSlot": true,
      "flags.macros.originalArmor": undefined
    });
  }
  removeActorListener(actor);
}

async function getBestDefense(actor) {
  let defenses = actor.system.proficiencies.defenses;
  let bestDef = null;
  let maxValue = -1;

  if (defenses.heavy.value > maxValue) {
    bestDef = defenses.heavy;
    maxValue = defenses.heavy.value;
  }
  if (defenses.medium.value > maxValue) {
    bestDef = defenses.medium;
    maxValue = defenses.medium.value;
  }
  if (defenses.light.value > maxValue) {
    bestDef = defenses.light;
    maxValue = defenses.light.value;
  }
  if (defenses.unarmored.value > maxValue) {
    bestDef = defenses.unarmored;
    maxValue = defenses.unarmored.value;
  }

  return bestDef;
}

function findFeatByName(actor, featName) {
  const feat = actor.items.find(item => item.name === featName && item.type === "feat");

  return feat ? feat : null;
}

async function addShieldBlockReaction(actor) {
  const existing = findFeatByName(actor, 'Shield Block');
  if (existing) {
    await actor.update({
      "flags.mcmacro.permanentShieldBlock": true
    });
    return;
  }

  let reaction = await game.items.find(item => item.name == "Shield Block" && item.type == "feat");
  if (!reaction) {
    reaction = await game.items.importFromCompendium(game.packs.get("pf2e.feats-srd"), "jM72TjJ965jocBV8");
  }

  const shieldBlock = (await actor.createEmbeddedDocuments('Item', [reaction.toObject()]))[0];
}

async function removeShieldBlockReaction(actor) {
  if (actor.flags.mcmacro && actor.flags.mcmacro.permanentShieldBlock) {
    return;
  }

  const feat = findFeatByName(actor, "Shield Block");
  feat.delete();
}

function isAttackRoll(chatMessage) {
  return chatMessage.flags && chatMessage.flags.pf2e && chatMessage.flags.pf2e.context
    && chatMessage.flags.pf2e.context.type === "attack-roll";
}

function getTargetActorId(chatMessage) {
  return chatMessage.flags && chatMessage.flags.pf2e && chatMessage.flags.pf2e.context
    && chatMessage.flags.pf2e.context.target && chatMessage.flags.pf2e.context.target.actor
    ? chatMessage.flags.pf2e.context.target.actor
    : '';
}

function checkIfCriticalHit(chatMessage) {
  return chatMessage.flags.pf2e.context.outcome === "criticalSuccess";
}

async function processChatMessage(chatMessage, actor) {
  console.log('Processing chat');
  if (!isAttackRoll(chatMessage)) {
    console.log('not attack');
    return;
  }

  const targetActorId = getTargetActorId(chatMessage);
  if (targetActorId != `Actor.${actor.id}`) {
    console.log('not same actor');
    return;
  }

  if (checkIfCriticalHit(chatMessage)) {
    console.log("Critical hit against " + actor.name);

    restoreArmor(actor);
    removeShield(actor);

    await removeActorListener(actor);
  }
}

async function removeActorListener(actor) {
  const hookId = actor.flags.mcmacro.listenerId;
  if (hookId) {
    Hooks.off("createChatMessage", hookId);
    await actor.update({
      "flags.mcmacro.listenerId": null
    });
    console.log("Listener removed");
  }
}
