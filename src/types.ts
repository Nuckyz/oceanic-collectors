import * as Oceanic from 'oceanic.js';

export type ButtonComponentInteraction<V extends Oceanic.AnyTextChannel | Oceanic.Uncached = Oceanic.AnyTextChannel | Oceanic.Uncached> = Oceanic.ComponentInteraction<V> & {
	data: Oceanic.MessageComponentButtonInteractionData;
}

export type SelectMenuComponentInteraction<V extends Oceanic.AnyTextChannel | Oceanic.Uncached = Oceanic.AnyTextChannel | Oceanic.Uncached> = Oceanic.ComponentInteraction<V> & {
	data: Oceanic.MessageComponentSelectMenuInteractionData;
}
