import Collector, { CollectorOptions } from './Collector';
import { ButtonComponentInteraction, SelectMenuComponentInteraction } from '../types';
import * as Oceanic from 'oceanic.js';

export type ComponentTypes = typeof Oceanic.Constants.ComponentTypes.BUTTON | typeof Oceanic.Constants.ComponentTypes.SELECT_MENU
export type ModalComponentTypes = typeof Oceanic.Constants.ComponentTypes.TEXT_INPUT;

export type InteractionTypes = typeof Oceanic.Constants.InteractionTypes.MESSAGE_COMPONENT | typeof Oceanic.Constants.InteractionTypes.MODAL_SUBMIT;

export interface MappedComponentTypes {
	[Oceanic.Constants.ComponentTypes.BUTTON]: ButtonComponentInteraction;
	[Oceanic.Constants.ComponentTypes.SELECT_MENU]: SelectMenuComponentInteraction;
}

export interface MappedModalComponentTypes {
	[Oceanic.Constants.ComponentTypes.TEXT_INPUT]: Oceanic.ModalSubmitInteraction;
}

export interface MappedInteractionTypesToComponentTypes {
	[Oceanic.Constants.InteractionTypes.MESSAGE_COMPONENT]: MappedComponentTypes;
	[Oceanic.Constants.InteractionTypes.MODAL_SUBMIT]: MappedModalComponentTypes;
}

export interface InteractionCollectorOptions {
	channel?: Oceanic.AnyTextChannel;
	guild?: Oceanic.Guild;
	interaction?: Oceanic.AnyInteractionGateway;
	message?: Oceanic.Message;
}

export type InteractionCollectorOptionsWithGenerics<K extends InteractionTypes, T extends keyof MappedInteractionTypesToComponentTypes[K]> = CollectorOptions<MappedInteractionTypesToComponentTypes[K][T]> & {
	componentType?: T;
	interactionType?: K;
} & InteractionCollectorOptions

export type InteractionCollectorEndReasons = 'guildDelete' | 'channelDelete' | 'threadDelete' | 'messageDelete';

export class InteractionCollector<K extends InteractionTypes = InteractionTypes, T extends keyof MappedInteractionTypesToComponentTypes[K] = keyof MappedInteractionTypesToComponentTypes[K]> extends Collector<MappedInteractionTypesToComponentTypes[K][T], InteractionCollectorEndReasons> {
	private channel: Oceanic.AnyTextChannel | Oceanic.Uncached | null = null;
	private componentType: T | null = null;
	private guildId: string | null = null;
	private interactionType: K | null = null;
	private messageId: string | null = null;
	private messageInteractionId: string | null = null;

	public constructor(private client: Oceanic.Client, public options: InteractionCollectorOptionsWithGenerics<K, T> = {}) {
		super(options);

		this.messageId = options.message?.id ?? null;
		this.messageInteractionId = options.interaction?.id ?? null;
		this.channel = options.interaction?.channel ?? options.message?.channel ?? options.channel ?? null;
		this.guildId = options.interaction?.guildID ?? options.message?.guildID ?? options.guild?.id ?? (options.channel instanceof Oceanic.GuildChannel ? options.channel.guild.id : null);
		this.componentType = options.componentType ?? null;
		this.interactionType = options.interactionType ?? null;

		const bulkDeleteListener = (messages: Oceanic.PossiblyUncachedMessage[]): void => {
			if (messages.find((message) => message.id === this.messageId)) this.stop('messageDelete');
		};

		if (this.messageId || this.messageInteractionId) {
			this.handleMessageDeletion = this.handleMessageDeletion.bind(this);
			this.client.on('messageDelete', this.handleMessageDeletion);
			this.client.on('messageDeleteBulk', bulkDeleteListener);
		}

		if (this.channel) {
			this.handleChannelDeletion = this.handleChannelDeletion.bind(this);
			this.handleThreadDeletion = this.handleThreadDeletion.bind(this);
			this.client.on('channelDelete', this.handleChannelDeletion);
			this.client.on('threadDelete', this.handleThreadDeletion);
		}

		if (this.guildId) {
			this.handleGuildDeletion = this.handleGuildDeletion.bind(this);
			this.client.on('guildDelete', this.handleGuildDeletion);
		}

		this.client.on('interactionCreate', this.handleCollect);

		this.once('end', () => {
			this.client.removeListener('interactionCreate', this.handleCollect);
			this.client.removeListener('messageDelete', this.handleMessageDeletion);
			this.client.removeListener('messageDeleteBulk', bulkDeleteListener);
			this.client.removeListener('channelDelete', this.handleChannelDeletion);
			this.client.removeListener('threadDelete', this.handleThreadDeletion);
			this.client.removeListener('guildDelete', this.handleGuildDeletion);
		});
	}

	private handleChannelDeletion(channel: Oceanic.AnyChannel): void {
		if (channel.id === this.channel?.id || (this.channel instanceof Oceanic.GuildChannel && channel.id === this.channel.parentID)) {
			this.stop('channelDelete');
		}
	}

	private handleGuildDeletion(guild: Oceanic.Guild | Oceanic.Uncached): void {
		if (guild.id === this.guildId) {
			this.stop('guildDelete');
		}
	}

	private handleMessageDeletion(message: Oceanic.PossiblyUncachedMessage): void {
		if (message.id === this.messageId) {
			this.stop('messageDelete');
		}

		if ('interaction' in message && message.interaction?.id === this.messageInteractionId) {
			this.stop('messageDelete');
		}
	}

	private handleThreadDeletion(thread: Oceanic.PossiblyUncachedThread): void {
		if (thread.id === this.channel?.id) {
			this.stop('threadDelete');
		}
	}

	public collect(interaction: Oceanic.AnyInteractionGateway): Oceanic.AnyInteractionGateway | null {
		if (this.interactionType && interaction.type !== this.interactionType) return null;
		if (interaction.type === Oceanic.Constants.InteractionTypes.MESSAGE_COMPONENT) {
			if (this.componentType && interaction.data.componentType !== this.componentType) return null;
			if (this.messageId && interaction.message.id !== this.messageId) return null;
			if (this.messageInteractionId && interaction.message.interaction?.id !== this.messageInteractionId) return null;
		}
		if (this.channel && interaction.channel.id !== this.channel.id) return null;
		if (this.guildId && interaction.guild?.id !== this.guildId) return null;

		return interaction;
	}

	public dispose(interaction: Oceanic.AnyInteractionGateway): Oceanic.AnyInteractionGateway | null {
		if (this.interactionType && interaction.type !== this.interactionType) return null;
		if (interaction.type === Oceanic.Constants.InteractionTypes.MESSAGE_COMPONENT) {
			if (this.componentType && interaction.data.componentType !== this.componentType) return null;
			if (this.messageId && interaction.message.id !== this.messageId) return null;
			if (this.messageInteractionId && interaction.message.interaction?.id !== this.messageInteractionId) return null;
		}
		if (this.channel && interaction.channel.id !== this.channel.id) return null;
		if (this.guildId && interaction.guild?.id !== this.guildId) return null;

		return interaction;
	}

	public empty(): void {
		this.collected = [];
		this.checkEnd();
	}
}

export function awaitComponentInteraction<T extends ComponentTypes = ComponentTypes>(client: Oceanic.Client, options: InteractionCollectorOptionsWithGenerics<typeof Oceanic.Constants.InteractionTypes.MESSAGE_COMPONENT, T> = {}): Promise<MappedComponentTypes[T] | null> {
	const newOptions = {
		...options,
		interactionType: Oceanic.Constants.InteractionTypes.MESSAGE_COMPONENT,
		max: 1
	} as InteractionCollectorOptionsWithGenerics<typeof Oceanic.Constants.InteractionTypes.MESSAGE_COMPONENT, T>;

	return new Promise<MappedComponentTypes[T] | null>((resolve) => {
		const collector = new InteractionCollector(client, newOptions);

		collector.once('end', (collectedInteractions) => {
			const interaction = collectedInteractions[0];

			if (interaction) resolve(interaction);
			else resolve(null);
		});
	});
}

export function awaitModalSubmit<T extends ModalComponentTypes = ModalComponentTypes>(client: Oceanic.Client, options: InteractionCollectorOptionsWithGenerics<typeof Oceanic.Constants.InteractionTypes.MODAL_SUBMIT, T>): Promise<MappedModalComponentTypes[T] | null> {
	const newOptions = {
		...options,
		interactionType: Oceanic.Constants.InteractionTypes.MODAL_SUBMIT,
		max: 1
	} as InteractionCollectorOptionsWithGenerics<typeof Oceanic.Constants.InteractionTypes.MODAL_SUBMIT, T>;

	return new Promise<MappedModalComponentTypes[T] | null>((resolve) => {
		const collector = new InteractionCollector(client, newOptions);

		collector.once('end', (collectedInteractions) => {
			const interaction = collectedInteractions[0];

			if (interaction) resolve(interaction);
			else resolve(null);
		});
	});
}
