import * as Oceanic from 'oceanic.js';

export type Uncached = {
	id: string;
}

export type PossiblyUncachedMessage = Oceanic.Message | {
	channel: Oceanic.AnyTextChannel | { id: string };
	id: string;
}

export type PossiblyUncachedThread = Oceanic.AnyThreadChannel | (Pick<Oceanic.AnyThreadChannel, 'id' | 'type'> & {
    parentID: string | null;
})

export type ButtonComponentInteraction = Oceanic.ComponentInteraction & {
	data: Oceanic.MessageComponentButtonInteractionData;
}

export type SelectMenuComponentInteraction = Oceanic.ComponentInteraction & {
	data: Oceanic.MessageComponentSelectMenuInteractionData;
}
