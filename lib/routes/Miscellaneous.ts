/** @module REST/Miscellaneous */
import * as Routes from "../util/Routes.js";
import type RESTManager from "../rest/RESTManager.js";
import type { RawSticker, RawStickerPack, Sticker, StickerPack } from "../types/guilds.js";
import type { VoiceRegion } from "../types/voice.js";
import type { RESTApplication, RawClientApplication } from "../types/index.js";
import Application from "../structures/Application.js";
import ClientApplication from "../structures/ClientApplication.js";

/** Methods that don't fit anywhere else. Located at {@link Client#rest | Client#rest}{@link RESTManager#misc | .misc}. */
export default class Miscellaneous {
    #manager: RESTManager;
    constructor(manager: RESTManager) {
        this.#manager = manager;
    }

    /**
     * Get the currently authenticated bot's application info.
     * @caching This method **does not** cache its result.
     */
    async getApplication(): Promise<Application> {
        return this.#manager.authRequest<RESTApplication>({
            method: "GET",
            path:   Routes.APPLICATION
        }).then(data => new Application(data, this.#manager.client));
    }

    /**
     * Get the currently authenticated bot's application info as a bare {@link ClientApplication | ClientApplication}.
     * @caching This method **does not** cache its result.
     */
    async getClientApplication(): Promise<ClientApplication> {
        return this.#manager.authRequest<RawClientApplication>({
            method: "GET",
            path:   Routes.APPLICATION
        }).then(data => new ClientApplication(data, this.#manager.client));
    }

    /**
     * Get the nitro sticker packs.
     * @deprecated Use {@link REST/Miscellaneous#getStickerPacks | getStickerPacks}. This will be removed in `1.9.0`.
     * @caching This method **does not** cache its result.
     */
    async getNitroStickerPacks(): Promise<Array<StickerPack>> {
        return this.getStickerPacks();
    }

    /**
     * Get a sticker.
     * @param stickerID The ID of the sticker to get.
     * @caching This method **may** cache its result. The result will not be cached if the guild is not cached, or if the sticker is not a guild sticker.
     * @caches {@link Guild#stickers | Guild#stickers}
     */
    async getSticker(stickerID: string): Promise<Sticker> {
        return this.#manager.authRequest<RawSticker>({
            method: "GET",
            path:   Routes.STICKER(stickerID)
        }).then(data => data.guild_id === undefined ? this.#manager.client.util.convertSticker(data) : this.#manager.client.guilds.get(data.guild_id)?.stickers.update(data) ?? this.#manager.client.util.convertSticker(data));
    }

    /**
     * Get the default sticker packs.
     * @caching This method **does not** cache its result.
     */
    async getStickerPacks(): Promise<Array<StickerPack>> {
        return this.#manager.authRequest<{ sticker_packs: Array<RawStickerPack>; }>({
            method: "GET",
            path:   Routes.STICKER_PACKS
        }).then(data => data.sticker_packs.map(pack => ({
            bannerAssetID:  pack.banner_asset_id,
            coverStickerID: pack.cover_sticker_id,
            description:    pack.description,
            id:             pack.id,
            name:           pack.name,
            skuID:          pack.sku_id,
            stickers:       pack.stickers.map(sticker => this.#manager.client.util.convertSticker(sticker))
        })));
    }

    /**
     * Get the list of usable voice regions.
     * @caching This method **does not** cache its result.
     */
    async getVoiceRegions(): Promise<Array<VoiceRegion>> {
        return this.#manager.authRequest<Array<VoiceRegion>>({
            method: "GET",
            path:   Routes.VOICE_REGIONS
        });
    }
}
