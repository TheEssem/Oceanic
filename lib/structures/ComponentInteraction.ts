/** @module ComponentInteraction */
import Interaction from "./Interaction.js";
import Message from "./Message.js";
import type Guild from "./Guild.js";
import Member from "./Member.js";
import Permission from "./Permission.js";
import GuildChannel from "./GuildChannel.js";
import type PrivateChannel from "./PrivateChannel.js";
import Role from "./Role.js";
import User from "./User.js";
import InteractionResolvedChannel from "./InteractionResolvedChannel.js";
import type Client from "../Client.js";
import type {
    InitialInteractionContent,
    InteractionContent,
    InteractionGuild,
    MessageComponentButtonInteractionData,
    MessageComponentInteractionResolvedData,
    MessageComponentSelectMenuInteractionData,
    ModalData,
    RawMessageComponentInteraction
} from "../types/interactions.js";
import type { AnyTextableGuildChannel, AnyInteractionChannel } from "../types/channels.js";
import type { JSONComponentInteraction } from "../types/json.js";
import type { Uncached } from "../types/shared.js";
import type { RawUser } from "../types/users.js";
import type { RawMember } from "../types/guilds.js";
import { ComponentTypes, InteractionResponseTypes, type SelectMenuTypes, type InteractionTypes } from "../Constants.js";
import SelectMenuValuesWrapper from "../util/SelectMenuValuesWrapper.js";
import TypedCollection from "../util/TypedCollection.js";
import { UncachedError } from "../util/Errors.js";

/** Represents a component interaction. */
export default class ComponentInteraction<V extends ComponentTypes.BUTTON | SelectMenuTypes = ComponentTypes.BUTTON | SelectMenuTypes, T extends AnyInteractionChannel | Uncached = AnyInteractionChannel | Uncached> extends Interaction {
    private _cachedChannel!: T extends AnyInteractionChannel ? T : undefined;
    private _cachedGuild?: T extends AnyTextableGuildChannel ? Guild : Guild | null;
    /** The permissions the bot has in the channel this interaction was sent from, if this interaction is sent from a guild. */
    appPermissions: T extends AnyTextableGuildChannel ? Permission : Permission | undefined;
    /** The ID of the channel this interaction was sent from. */
    channelID: string;
    /** The data associated with the interaction. */
    data: V extends ComponentTypes.BUTTON ? MessageComponentButtonInteractionData : MessageComponentSelectMenuInteractionData;
    /** The id of the guild this interaction was sent from, if applicable. */
    guildID: T extends AnyTextableGuildChannel ? string : string | null;
    /** The preferred [locale](https://discord.com/developers/docs/reference#locales) of the guild this interaction was sent from, if applicable. */
    guildLocale: T extends AnyTextableGuildChannel ? string : string | undefined;
    /** The partial guild this interaction was sent from, if applicable. */
    guildPartial?: T extends AnyTextableGuildChannel ? InteractionGuild : InteractionGuild | undefined;
    /** The [locale](https://discord.com/developers/docs/reference#locales) of the invoking user. */
    locale: string;
    /** The member associated with the invoking user, if this interaction is sent from a guild. */
    member: T extends AnyTextableGuildChannel ? Member : Member | null;
    /** The permissions of the member associated with the invoking user, if this interaction is sent from a guild. */
    memberPermissions: T extends AnyTextableGuildChannel ? Permission : Permission | null;
    /** The message the interaction is from. */
    message: Message<T>;
    declare type: InteractionTypes.MESSAGE_COMPONENT;
    /** The user that invoked this interaction. */
    user: User;
    constructor(data: RawMessageComponentInteraction, client: Client) {
        super(data, client);
        if (data.message !== undefined && data.guild_id !== undefined) {
            data.message.guild_id = data.guild_id;
        }

        this.appPermissions = (data.app_permissions === undefined ? undefined : new Permission(data.app_permissions)) as T extends AnyTextableGuildChannel ? Permission : Permission | undefined;
        this.channelID = data.channel_id!;
        this.guildID = (data.guild_id ?? null) as T extends AnyTextableGuildChannel ? string : string | null;
        this.guildLocale = data.guild_locale as T extends AnyTextableGuildChannel ? string : string | undefined;
        this.guildPartial = data.guild;
        this.locale = data.locale!;
        this.member = (data.member === undefined ? null : this.client.util.updateMember(data.guild_id!, data.member.user.id, data.member)) as T extends AnyTextableGuildChannel ? Member : Member | null;
        this.memberPermissions = (data.member === undefined ? null : new Permission(data.member.permissions)) as T extends AnyTextableGuildChannel ? Permission : Permission | null;
        this.message = (this.channel && "messages" in this.channel && (this.channel.messages.update(data.message) as Message<T>)) || new Message<T>(data.message, client);
        this.user = client.users.update((data.user ?? data.member!.user)!);

        switch (data.data.component_type) {
            case ComponentTypes.BUTTON: {
                this.data = {
                    componentType: data.data.component_type,
                    customID:      data.data.custom_id
                } as V extends ComponentTypes.BUTTON ? MessageComponentButtonInteractionData : MessageComponentSelectMenuInteractionData;
                break;
            }
            case ComponentTypes.STRING_SELECT:
            case ComponentTypes.USER_SELECT:
            case ComponentTypes.ROLE_SELECT:
            case ComponentTypes.MENTIONABLE_SELECT:
            case ComponentTypes.CHANNEL_SELECT: {
                const resolved: MessageComponentInteractionResolvedData = {
                    channels: new TypedCollection(InteractionResolvedChannel, client),
                    members:  new TypedCollection(Member, client),
                    roles:    new TypedCollection(Role, client),
                    users:    new TypedCollection(User, client)
                };

                if (data.data.resolved) {
                    if (data.data.resolved.channels) {
                        for (const channel of Object.values(data.data.resolved.channels)) resolved.channels.update(channel);
                    }

                    if (data.data.resolved.members) {
                        for (const [id, member] of Object.entries(data.data.resolved.members)) {
                            const m = member as unknown as RawMember & { user: RawUser; };
                            m.user = data.data.resolved.users![id];
                            resolved.members.add(client.util.updateMember(data.guild_id!, id, m));
                        }
                    }

                    if (data.data.resolved.roles) {
                        for (const role of Object.values(data.data.resolved.roles)) {
                            try {
                                resolved.roles.add(this.guild?.roles.update(role, this.guildID!) ?? new Role(role, client, this.guildID!));
                            } catch {
                                resolved.roles.add(new Role(role, client, this.guildID!));
                            }
                        }
                    }

                    if (data.data.resolved.users) {
                        for (const user of Object.values(data.data.resolved.users)) resolved.users.add(client.users.update(user));
                    }
                }

                this.data = {
                    componentType: data.data.component_type,
                    customID:      data.data.custom_id,
                    values:        new SelectMenuValuesWrapper(resolved, data.data.values!),
                    resolved
                } as V extends ComponentTypes.BUTTON ? MessageComponentButtonInteractionData : MessageComponentSelectMenuInteractionData;
                break;
            }
        }
    }

    /** The channel this interaction was sent from. */
    get channel(): T extends AnyInteractionChannel ? T : undefined {
        return this._cachedChannel ??= this.client.getChannel(this.channelID) as T extends AnyInteractionChannel ? T : undefined;
    }

    /** The guild this interaction was sent from, if applicable. This will throw an error if the guild is not cached. */
    get guild(): T extends AnyTextableGuildChannel ? Guild : Guild | null {
        if (this.guildID !== null && this._cachedGuild !== null) {
            this._cachedGuild = this.client.guilds.get(this.guildID);
            if (!this._cachedGuild) {
                throw new UncachedError(this, "guild", "GUILDS", this.client);
            }

            return this._cachedGuild;
        }

        return this._cachedGuild === null ? this._cachedGuild : (this._cachedGuild = null as T extends AnyTextableGuildChannel ? Guild : Guild | null);
    }

    /**
     * Create a followup message.
     * @param options The options for creating the followup message.
     */
    async createFollowup(options: InteractionContent): Promise<Message<T>> {
        return this.client.rest.interactions.createFollowupMessage<T>(this.applicationID, this.token, options);
    }

    /**
     * Create a message through this interaction. This is an initial response, and more than one initial response cannot be used. Use  {@link ComponentInteraction#createFollowup | createFollowup}.
     * @note You cannot attach files in an initial response. Defer the interaction, then use {@link ComponentInteraction#createFollowup | createFollowup}.
     * @param options The options for the message.
     */
    async createMessage(options: InitialInteractionContent): Promise<void> {
        if (this.acknowledged) {
            throw new TypeError("Interactions cannot have more than one initial response.");
        }
        if ("files" in options && (options.files as []).length !== 0) {
            this.client.emit("warn", "You cannot attach files in an initial response. Defer the interaction, then use createFollowup.");
        }
        this.acknowledged = true;
        return this.client.rest.interactions.createInteractionResponse(this.id, this.token, { type: InteractionResponseTypes.CHANNEL_MESSAGE_WITH_SOURCE, data: options });
    }

    /**
     * Respond to this interaction with a modal. This is an initial response, and more than one initial response cannot be used.
     * @param options The options for the modal.
     */
    async createModal(options: ModalData): Promise<void> {
        if (this.acknowledged) {
            throw new TypeError("Interactions cannot have more than one initial response.");
        }
        this.acknowledged = true;
        return this.client.rest.interactions.createInteractionResponse(this.id, this.token, { type: InteractionResponseTypes.MODAL, data: options });
    }

    /**
     * Defer this interaction with a `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` response. This is an initial response, and more than one initial response cannot be used.
     * @param flags The [flags](https://discord.com/developers/docs/resources/channel#message-object-message-flags) to respond with.
     */
    async defer(flags?: number): Promise<void> {
        if (this.acknowledged) {
            throw new TypeError("Interactions cannot have more than one initial response.");
        }
        this.acknowledged = true;
        return this.client.rest.interactions.createInteractionResponse(this.id, this.token, { type: InteractionResponseTypes.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags } });
    }

    /**
     * Defer this interaction with a `DEFERRED_UPDATE_MESSAGE` response. This is an initial response, and more than one initial response cannot be used.
     * @param flags The [flags](https://discord.com/developers/docs/resources/channel#message-object-message-flags) to respond with.
     */
    async deferUpdate(flags?: number): Promise<void> {
        if (this.acknowledged) {
            throw new TypeError("Interactions cannot have more than one initial response.");
        }
        this.acknowledged = true;
        return this.client.rest.interactions.createInteractionResponse(this.id, this.token, { type: InteractionResponseTypes.DEFERRED_UPDATE_MESSAGE, data: { flags } });
    }

    /**
     * Delete a follow-up message.
     * @param messageID The ID of the message.
     */
    async deleteFollowup(messageID: string): Promise<void> {
        return this.client.rest.interactions.deleteFollowupMessage(this.applicationID, this.token, messageID);
    }

    /**
     * Delete the original interaction response.
     */
    async deleteOriginal(): Promise<void> {
        return this.client.rest.interactions.deleteOriginalMessage(this.applicationID, this.token);
    }

    /**
     * Edit a followup message.
     * @param messageID The ID of the message.
     * @param options The options for editing the followup message.
     */
    async editFollowup(messageID: string, options: InteractionContent): Promise<Message<T>> {
        return this.client.rest.interactions.editFollowupMessage<T>(this.applicationID, this.token, messageID, options);
    }

    /**
     * Edit the original interaction response.
     * @param options The options for editing the original message.
     */
    async editOriginal(options: InteractionContent): Promise<Message<T>> {
        return this.client.rest.interactions.editOriginalMessage<T>(this.applicationID, this.token, options);
    }

    /**
     * Edit the message this interaction is from. If this interaction has already been acknowledged, use `editOriginal`.
     * @param options The options for editing the message.
     */
    async editParent(options: InteractionContent): Promise<void> {
        if (this.acknowledged) {
            throw new TypeError("Interactions cannot have more than one initial response.");
        }
        this.acknowledged = true;
        return this.client.rest.interactions.createInteractionResponse(this.id, this.token, { type: InteractionResponseTypes.UPDATE_MESSAGE, data: options });
    }

    /**
     * Get a followup message.
     * @param messageID The ID of the message.
     */
    async getFollowup(messageID: string): Promise<Message<T>> {
        return this.client.rest.interactions.getFollowupMessage<T>(this.applicationID, this.token, messageID);
    }

    /**
     * Get the original interaction response.
     */
    async getOriginal(): Promise<Message<T>> {
        return this.client.rest.interactions.getOriginalMessage<T>(this.applicationID, this.token);
    }

    /** Whether this interaction belongs to a cached guild channel. The only difference on using this method over a simple if statement is to easily update all the interaction properties typing definitions based on the channel it belongs to. */
    inCachedGuildChannel(): this is ComponentInteraction<V, AnyTextableGuildChannel> {
        return this.channel instanceof GuildChannel;
    }

    /** Whether this interaction belongs to a private channel (PrivateChannel or uncached). The only difference on using this method over a simple if statement is to easily update all the interaction properties typing definitions based on the channel it belongs to. */
    inPrivateChannel(): this is ComponentInteraction<V, PrivateChannel | Uncached> {
        return this.guildID === null;
    }

    /** Whether this interaction is a button interaction. The only difference on using this method over a simple if statement is to easily update all the interaction properties typing definitions based on the component type. */
    isButtonComponentInteraction(): this is ComponentInteraction<ComponentTypes.BUTTON, T> {
        return this.data.componentType === ComponentTypes.BUTTON;
    }

    /** Whether this interaction is a select menu interaction. The only difference on using this method over a simple if statement is to easily update all the interaction properties typing definitions based on the component type. */
    isSelectMenuComponentInteraction(): this is ComponentInteraction<SelectMenuTypes, T> {
        return this.data.componentType === ComponentTypes.STRING_SELECT
            || this.data.componentType === ComponentTypes.CHANNEL_SELECT
            || this.data.componentType === ComponentTypes.ROLE_SELECT
            || this.data.componentType === ComponentTypes.MENTIONABLE_SELECT
            || this.data.componentType === ComponentTypes.USER_SELECT;
    }

    override toJSON(): JSONComponentInteraction {
        return {
            ...super.toJSON(),
            appPermissions: this.appPermissions?.toJSON(),
            channelID:      this.channelID,
            data:           this.data,
            guildID:        this.guildID ?? undefined,
            guildLocale:    this.guildLocale,
            locale:         this.locale,
            member:         this.member?.toJSON(),
            type:           this.type,
            user:           this.user.toJSON()
        };
    }
}
