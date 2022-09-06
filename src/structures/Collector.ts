import TypedEventEmitter from './TypedEventEmitter';

export interface CollectorEvents<T> {
	collect: (collected: T) => any;
	dispose: (disposed: any) => any;
	ignore: (ignored: T) => any;
	end(collected: T[], reason: string): any;
}

export interface CollectorOptions<T> {
	dispose?: boolean;
	idle?: number;
	max?: number;
	time?: number;
	filter?(colleted: T): boolean | Promise<boolean>;
}

export abstract class Collector<T> extends TypedEventEmitter<CollectorEvents<T>> {
	private idleTimeout: NodeJS.Timeout | null = null;
	private max: number | null = null;
	private timeout: NodeJS.Timeout | null = null;

	protected endReason: string | null = null;

	public collected: T[] = [];
	public ended = false;
	public filter: (collected: T) => boolean | Promise<boolean>;

	abstract collect(...args: any[]): any;

	abstract dispose(...args: any[]): any;

	public constructor(public options: CollectorOptions<T> = {}) {
		super();

		this.filter = options.filter ?? ((): true => true);

		if (options.time) this.timeout = setTimeout(() => this.stop('time'), options.time).unref();
		if (options.idle) this.idleTimeout = setTimeout(() => this.stop('idle'), options.idle).unref();
		if (options.max) this.max = options.max;

		this.handleCollect = this.handleCollect.bind(this);
		this.handleDispose = this.handleDispose.bind(this);
	}

	protected async handleCollect(collected: any): Promise<void> {
		const collectedThing = await this.collect(collected);

		if (collectedThing) {
			const filterResult = await this.filter(collectedThing);

			if (filterResult) {
				this.collected.push(collectedThing);

				this.emit('collect', collectedThing);

				if (this.idleTimeout) {
					clearTimeout(this.idleTimeout);
					this.idleTimeout = setTimeout(() => this.stop('idle'), this.options.idle).unref();
				}

				if (this.max && this.collected.length >= this.max) this.stop('limit');
			} else {
				this.emit('ignore', collectedThing);
			}
		}

		this.checkEnd();
	}

	protected async handleDispose(collected: any): Promise<void> {
		if (!this.options.dispose) return;

		const dispose = this.dispose(collected);

		if (!dispose || !(await this.filter(dispose)) || !this.collected.includes(dispose)) return;

		this.collected.splice(this.collected.indexOf(dispose), 1);

		this.emit('dispose', dispose);

		this.checkEnd();
	}

	public get next(): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			if (this.ended) {
				reject(this.collected);
				return;
			}

			const cleanup = (): void => {
				this.removeListener('collect', onCollect);
				this.removeListener('end', onEnd);
			};

			const onCollect = (collected: T): void => {
				cleanup();
				resolve(collected);
			};

			const onEnd = (): void => {
				cleanup();
				reject(this.collected);
			};

			this.on('collect', onCollect);
			this.on('end', onEnd);
		});
	}

	public async * [Symbol.asyncIterator](): AsyncGenerator<Awaited<T | undefined>> {
		const queue: T[] = [];
		const onCollect = (collected: T): number => queue.push(collected);
		this.on('collect', onCollect);

		try {
			while (queue.length || !this.ended) {
				if (queue.length) {
					yield queue.shift();
				} else {
					await new Promise<void>((resolve) => {
						const tick = (): void => {
							this.removeListener('collect', tick);
							this.removeListener('end', tick);
							return resolve();
						};
						this.on('collect', tick);
						this.on('end', tick);
					});
				}
			}
		} finally {
			this.removeListener('collect', onCollect);
		}
	}

	public checkEnd(): boolean {
		const reason = this.endReason;
		if (reason) this.stop(reason);
		return Boolean(reason);
	}

	public resetTimer({ time, idle }: { idle?: number; time?: number } = {}): void {
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = setTimeout(() => this.stop('time'), time ?? this.options.time).unref();
		}
		if (this.idleTimeout) {
			clearTimeout(this.idleTimeout);
			this.idleTimeout = setTimeout(() => this.stop('idle'), idle ?? this.options.idle).unref();
		}
	}

	public stop(reason = 'user'): void {
		if (this.ended) return;

		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
		if (this.idleTimeout) {
			clearTimeout(this.idleTimeout);
			this.idleTimeout = null;
		}

		this.endReason = reason;
		this.ended = true;

		this.emit('end', this.collected, reason);
	}
}

export default Collector;
