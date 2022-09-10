import * as Oceanic from 'oceanic.js';

export type ButtonComponentInteraction = Oceanic.ComponentInteraction & {
	data: Oceanic.MessageComponentButtonInteractionData;
}

export type SelectMenuComponentInteraction = Oceanic.ComponentInteraction & {
	data: Oceanic.MessageComponentSelectMenuInteractionData;
}
