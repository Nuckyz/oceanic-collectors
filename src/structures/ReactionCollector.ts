import Collector, { CollectorOptions } from './Collector';
import { PossiblyUncachedMessage, PossiblyUncachedThread, Uncached } from '../types';
import * as Oceanic from 'oceanic.js';

export interface CollectedReaction<T extends Oceanic.Message> {
	message: T;
	reaction: Oceanic.PartialEmoji;
	user: Oceanic.Member | Oceanic.Uncached;
}

export type ReactionCollectorEndReasons = 'guildDelete' | 'channelDelete' | 'threadDelete' | 'messageDelete';

export class ReactionCollector<T extends Oceanic.Message> extends Collector<CollectedReaction<T>, ReactionCollectorEndReasons> {
	public constructor(private client: Oceanic.Client, private message: T, public options: CollectorOptions<CollectedReaction<T>> = {}) {
		super(options);

		const bulkDeleteListener = (messages: PossiblyUncachedMessage[]): void => {
			if (messages.find((message) => message.id === this.message.id)) this.stop('messageDelete');
		};

		this.empty = this.empty.bind(this);
		this.handleChannelDeletion = this.handleChannelDeletion.bind(this);
		this.handleThreadDeletion = this.handleThreadDeletion.bind(this);
		this.handleGuildDeletion = this.handleGuildDeletion.bind(this);
		this.handleMessageDeletion = this.handleMessageDeletion.bind(this);

		this.client.on('messageReactionAdd', this.handleCollect);
		this.client.on('messageReactionRemove', this.handleDispose);
		this.client.on('messageReactionRemoveAll', this.empty);
		this.client.on('messageDelete', this.handleMessageDeletion);
		this.client.on('messageDeleteBulk', bulkDeleteListener);
		this.client.on('channelDelete', this.handleChannelDeletion);
		this.client.on('threadDelete', this.handleThreadDeletion);
		this.client.on('guildDelete', this.handleGuildDeletion);

		this.once('end', () => {
			this.client.removeListener('messageReactionAdd', this.handleCollect);
			this.client.removeListener('messageReactionRemove', this.handleDispose);
			this.client.removeListener('messageReactionRemoveAll', this.empty);
			this.client.removeListener('messageDelete', this.handleMessageDeletion);
			this.client.removeListener('messageDeleteBulk', bulkDeleteListener);
			this.client.removeListener('channelDelete', this.handleChannelDeletion);
			this.client.removeListener('threadDelete', this.handleThreadDeletion);
			this.client.removeListener('guildDelete', this.handleGuildDeletion);
		});
	}

	private handleChannelDeletion(channel: Oceanic.AnyChannel): void {
		if (channel.id === this.message.channel.id || (this.message.channel instanceof Oceanic.GuildChannel && channel.id === this.message.channel.parentID)) {
			this.stop('channelDelete');
		}
	}

	private handleGuildDeletion(guild: Oceanic.Guild | Uncached): void {
		if (this.message.channel instanceof Oceanic.GuildChannel) {
			if (guild.id === this.message.channel.guild.id) {
				this.stop('guildDelete');
			}
		}
	}

	private handleMessageDeletion(message: PossiblyUncachedMessage): void {
		if (message.id === this.message.id) {
			this.stop('messageDelete');
		}
	}

	private handleThreadDeletion(thread: PossiblyUncachedThread): void {
		if (thread.id === this.message.channel.id) {
			this.stop('threadDelete');
		}
	}

	public collect(message: T, reaction: Oceanic.PartialEmoji, user: Oceanic.Member | Oceanic.Uncached): CollectedReaction<T> | null {
		if (message.id !== this.message.id) return null;

		return {
			reaction,
			message,
			user
		};
	}

	public dispose(message: T, reaction: Oceanic.PartialEmoji, userId: string): CollectedReaction<T> | null {
		if (message.id !== this.message.id) return null;

		return {
			reaction,
			message,
			user: {
				id: userId
			}
		};
	}

	public empty(): void {
		this.collected = [];
		this.checkEnd();
	}
}

export function awaitReactions<T extends Oceanic.Message>(client: Oceanic.Client, message: T, options: CollectorOptions<CollectedReaction<T>> = {}): Promise<CollectedReaction<T>[]> {
	return new Promise<CollectedReaction<T>[]>((resolve): void => {
		const collector = new ReactionCollector(client, message, options);

		collector.once('end', (collectedReactions) => {
			resolve(collectedReactions);
		});
	});
}
