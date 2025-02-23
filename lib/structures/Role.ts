/** @module Role */
import Base from "./Base";
import Permission from "./Permission";
import type Guild from "./Guild";
import type Client from "../Client";
import type { RawRole, EditRoleOptions } from "../types/guilds";
import type { JSONRole } from "../types/json";
import { UncachedError } from "../util/Errors";

/** Represents a role in a guild. */
export default class Role extends Base {
    private _cachedGuild?: Guild;
    /** The id of the guild this role is in. */
    guildID: string;
    /** The name of this role. */
    name: string;
    /** The permissions of this role. */
    permissions: Permission;
    constructor(data: RawRole, client: Client, guildID: string) {
        super(data.id, client);
        this.guildID = guildID;
        this.name = data.name;
        this.permissions = new Permission(data.permissions);
        this.update(data);
    }

    protected override update(data: Partial<RawRole>): void {
        if (data.name !== undefined) {
            this.name = data.name;
        }
        if (data.permissions !== undefined) {
            this.permissions = new Permission(data.permissions);
        }
    }

    /** The guild this role is in. This will throw an error if the guild is not cached. */
    get guild(): Guild {
        this._cachedGuild ??= this.client.guilds.get(this.guildID);
        if (!this._cachedGuild) {
            if (this.client.options.restMode) {
                throw new UncachedError(`${this.constructor.name}#guild is not present when rest mode is enabled.`);
            }

            if (!this.client.shards.connected) {
                throw new UncachedError(`${this.constructor.name}#guild is not present without a gateway connection.`);
            }

            throw new UncachedError(`${this.constructor.name}#guild is not present.`);
        }

        return this._cachedGuild;
    }

    /** A string that will mention this role. */
    get mention(): string {
        return `<@&${this.id}>`;
    }

    /**
     * Delete this role.
     * @param reason The reason for deleting the role.
     */
    async delete(reason?: string): Promise<void> {
        return this.client.rest.guilds.deleteRole(this.guildID, this.id, reason);
    }

    /**
     * Edit this role.
     * @param options The options for editing the role.
     */
    async edit(options: EditRoleOptions): Promise<Role> {
        return this.client.rest.guilds.editRole(this.guildID, this.id, options);
    }

    override toJSON(): JSONRole {
        return {
            ...super.toJSON(),
            guildID:     this.guildID,
            name:        this.name,
            permissions: this.permissions.toJSON()
        };
    }
}
