import Collector, { CollectorOptions } from './Collector';
import * as Oceanic from 'oceanic.js';

export type InteractionTypes = typeof Oceanic.Constants.InteractionTypes.MESSAGE_COMPONENT | typeof Oceanic.Constants.InteractionTypes.MODAL_SUBMIT;

export interface MappedComponentTypes {
	[Oceanic.Constants.ComponentTypes.BUTTON]: Oceanic.ComponentInteraction<Oceanic.Constants.ComponentTypes.BUTTON>;
	[Oceanic.Constants.ComponentTypes.STRING_SELECT]: Oceanic.ComponentInteraction<Oceanic.Constants.ComponentTypes.STRING_SELECT>;
	[Oceanic.Constants.ComponentTypes.USER_SELECT]: Oceanic.ComponentInteraction<Oceanic.Constants.ComponentTypes.USER_SELECT>;
	[Oceanic.Constants.ComponentTypes.ROLE_SELECT]: Oceanic.ComponentInteraction<Oceanic.Constants.ComponentTypes.ROLE_SELECT>;
	[Oceanic.Constants.ComponentTypes.MENTIONABLE_SELECT]: Oceanic.ComponentInteraction<Oceanic.Constants.ComponentTypes.MENTIONABLE_SELECT>;
	[Oceanic.Constants.ComponentTypes.CHANNEL_SELECT]: Oceanic.ComponentInteraction<Oceanic.Constants.ComponentTypes.CHANNEL_SELECT>;
}

export interface MappedModalComponentTypes {
	[Oceanic.Constants.ComponentTypes.TEXT_INPUT]: Oceanic.ModalSubmitInteraction;
}

export interface MappedInteractionTypesToComponentTypes {
	[Oceanic.Constants.InteractionTypes.MESSAGE_COMPONENT]: MappedComponentTypes;
	[Oceanic.Constants.InteractionTypes.MODAL_SUBMIT]: MappedModalComponentTypes;
}

export interface InteractionCollectorOptions {
	/** The channel to listen to interactions from. */
	channel?: Oceanic.AnyTextChannel;
	/** The guild to listen to interactions from. */
	guild?: Oceanic.Guild;
	/** The interaction response to listen to message component interactions from. */
	interaction?: Oceanic.AnyInteractionGateway;
	/** The message to listen to interactions from. */
	message?: Oceanic.Message;
}

export type InteractionCollectorOptionsWithGenerics<K extends InteractionTypes, T extends keyof MappedInteractionTypesToComponentTypes[K]> = CollectorOptions<MappedInteractionTypesToComponentTypes[K][T]> & {
	/** The type of components to listen for. */
	componentType?: T;
	/** The type of interactions to listen for. */
	interactionType?: K;
} & InteractionCollectorOptions

export type InteractionCollectorEndReasons = 'guildDelete' | 'channelDelete' | 'threadDelete' | 'messageDelete';

/** Collects interactions. Will automatically stop if the message, channel, or guild is deleted. */
export class InteractionCollector<K extends InteractionTypes = InteractionTypes, T extends keyof MappedInteractionTypesToComponentTypes[K] = keyof MappedInteractionTypesToComponentTypes[K]> extends Collector<MappedInteractionTypesToComponentTypes[K][T], InteractionCollectorEndReasons> {
	private channel: Oceanic.AnyTextChannel | Oceanic.Uncached | null = null;
	private componentType: T | null = null;
	private guildID: string | null = null;
	private interactionType: K | null = null;
	private messageID: string | null = null;
	private messageInteractionID: string | null = null;

	/**
	 * @param client The Oceanic client to apply the collector on.
	 * @param options The collector options.
	 */
	public constructor(private client: Oceanic.Client, public options: InteractionCollectorOptionsWithGenerics<K, T> = {}) {
		super(options);

		this.messageID = options.message?.id ?? null;
		this.messageInteractionID = options.interaction?.id ?? null;
		this.channel = options.interaction?.channel ?? options.message?.channel ?? options.channel ?? null;
		this.guildID = options.interaction?.guildID ?? options.message?.guildID ?? options.guild?.id ?? (options.channel instanceof Oceanic.GuildChannel ? options.channel.guild.id : null);
		this.componentType = options.componentType ?? null;
		this.interactionType = options.interactionType ?? null;

		const bulkDeleteListener = (messages: Oceanic.PossiblyUncachedMessage[]): void => {
			if (messages.find((message) => message.id === this.messageID)) this.stop('messageDelete');
		};

		if (this.messageID || this.messageInteractionID) {
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

		if (this.guildID) {
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

	private handleChannelDeletion(channel: Oceanic.AnyGuildChannelWithoutThreads | Oceanic.PrivateChannel | Oceanic.DeletedPrivateChannel): void {
		if (channel.id === this.channel?.id || (this.channel instanceof Oceanic.GuildChannel && channel.id === this.channel.parentID)) {
			this.stop('channelDelete');
		}
	}

	private handleGuildDeletion(guild: Oceanic.Guild | Oceanic.Uncached): void {
		if (guild.id === this.guildID) {
			this.stop('guildDelete');
		}
	}

	private handleMessageDeletion(message: Oceanic.PossiblyUncachedMessage): void {
		if (message.id === this.messageID) {
			this.stop('messageDelete');
		}

		if ('interaction' in message && message.interaction?.id === this.messageInteractionID) {
			this.stop('messageDelete');
		}
	}

	private handleThreadDeletion(thread: Oceanic.PossiblyUncachedThread): void {
		if (thread.id === this.channel?.id) {
			this.stop('threadDelete');
		}
	}

	protected collect(interaction: Oceanic.AnyInteractionGateway): Oceanic.AnyInteractionGateway | null {
		if (this.interactionType && interaction.type !== this.interactionType) return null;
		if (interaction.type === Oceanic.Constants.InteractionTypes.MESSAGE_COMPONENT) {
			if (this.componentType && interaction.data.componentType !== this.componentType) return null;
			if (this.messageID && interaction.message.id !== this.messageID) return null;
			if (this.messageInteractionID && interaction.message.interaction?.id !== this.messageInteractionID) return null;
		}
		if (this.channel && interaction.channelID !== this.channel.id) return null;
		if (this.guildID && interaction.guildID !== this.guildID) return null;

		return interaction;
	}

	protected dispose(interaction: Oceanic.AnyInteractionGateway): Oceanic.AnyInteractionGateway | null {
		if (this.interactionType && interaction.type !== this.interactionType) return null;
		if (interaction.type === Oceanic.Constants.InteractionTypes.MESSAGE_COMPONENT) {
			if (this.componentType && interaction.data.componentType !== this.componentType) return null;
			if (this.messageID && interaction.message.id !== this.messageID) return null;
			if (this.messageInteractionID && interaction.message.interaction?.id !== this.messageInteractionID) return null;
		}
		if (this.channel && interaction.channelID !== this.channel.id) return null;
		if (this.guildID && interaction.guildID !== this.guildID) return null;

		return interaction;
	}
}

/**
 * Await a compontent interaction.
 * @param client The Oceanic client to apply the collector on.
 * @param options The options to await the compontent interaction with.
 */
export function awaitComponentInteraction<T extends Oceanic.Constants.MessageComponentTypes = Oceanic.Constants.MessageComponentTypes>(client: Oceanic.Client, options: InteractionCollectorOptionsWithGenerics<typeof Oceanic.Constants.InteractionTypes.MESSAGE_COMPONENT, T> = {}): Promise<MappedComponentTypes[T] | null> {
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

/**
 * Await a modal submit.
 * @param client The Oceanic client to apply the collector on.
 * @param options The options to await the modal submit with.
 */
export function awaitModalSubmit<T extends Oceanic.Constants.ModalComponentTypes = Oceanic.Constants.ModalComponentTypes>(client: Oceanic.Client, options: InteractionCollectorOptionsWithGenerics<typeof Oceanic.Constants.InteractionTypes.MODAL_SUBMIT, T>): Promise<MappedModalComponentTypes[T] | null> {
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
