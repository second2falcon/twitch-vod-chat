/* eslint-disable @typescript-eslint/no-explicit-any -- loose mocks of chat logs and the embed player */
import { mount, VueWrapper } from '@vue/test-utils';
import VODPlayer from '@/components/VODPlayer.vue';
import ChatEmote from './ChatEmote.vue';
import ChatBadge from './ChatBadge.vue';
import { store } from '@/store';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findFirstCommentAfter } from '@/helpers';

function makeComment(i: number, t: number, extra: Record<string, any> = {}) {
    return {
        _id: `c${i}`,
        content_offset_seconds: t,
        commenter: { display_name: `user${i}` },
        message: {
            body: `msg${i}`,
            fragments: [{ text: `msg${i}`, emoticon: null }],
            user_badges: [],
            user_color: '#ffffff',
        },
        ...extra,
    } as any;
}

/**
 * One comment every 0.5s for 30 minutes, with a quiet 11 minute gap after 25 minutes
 */
function makeChat() {
    const comments = [] as any[];
    let t = 0;
    let i = 0;
    while (t < 2400) {
        comments.push(makeComment(i++, t));
        t += t > 1500 && t < 1501 ? 660 : 0.5;
    }
    return comments;
}

describe('VODPlayer chat sync', () => {

    let wrapper: VueWrapper<any>;
    let vm: any;
    let comments: any[];
    let alertSpy: ReturnType<typeof vi.fn>;
    let videoTime: number;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 0, 1, 20, 0, 0).getTime());
        alertSpy = vi.fn();
        (globalThis as any).alert = alertSpy;

        store.settings.chatBackfillCount = 20;

        comments = makeChat();
        wrapper = mount(VODPlayer);
        vm = wrapper.vm;
        vi.spyOn(vm, 'getChatLog').mockReturnValue({ comments });
        vm.commentAmount = comments.length;
        vm.vodLength = 100000;
        vm.lastSavedPlaybackPosition = Infinity; // no localStorage saves
        vm.commentQueue = [];

        videoTime = 0;
        vm.embedPlayer = {
            getCurrentTime: async () => videoTime,
            getDuration: async () => 100000,
            pause: async () => { },
            play: async () => { },
            seek: async (s: number) => { videoTime = s; },
        };
    });

    afterEach(() => {
        wrapper.unmount();
        vi.useRealTimers();
    });

    const queueIds = () => vm.commentQueue.map((c: any) => c.gid);
    const idsUpTo = (time: number, n: number) => {
        const end = findFirstCommentAfter(comments, time);
        return comments.slice(Math.max(0, end - n), end).map((c) => c._id);
    };
    /** n backfilled before seekTime, then everything up to nowTime */
    const idsSeekThenPlay = (seekTime: number, nowTime: number, n = 20) => {
        const start = Math.max(0, findFirstCommentAfter(comments, seekTime) - n);
        return comments.slice(start, findFirstCommentAfter(comments, nowTime)).map((c) => c._id);
    };

    /** play the video in 100ms ticks, wall clock moving along */
    async function playFor(seconds: number) {
        for (let k = 0; k < seconds * 10; k++) {
            videoTime += 0.1;
            vi.setSystemTime(Date.now() + 100);
            await vm.tick();
        }
    }

    it('backfills the last N comments on seek and continues without duplicates or gaps', async () => {
        vm.commentLimit = 100000; // keep everything so the full sequence can be checked
        videoTime = 600;
        await vm.resetChat();

        expect(queueIds()).toEqual(idsUpTo(600, 20));
        expect(vm.nextCommentIndex).toBe(findFirstCommentAfter(comments, 600));

        await playFor(30);

        const ids = queueIds();
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toEqual(idsSeekThenPlay(600, videoTime));
        expect(ids.length).toBeGreaterThanOrEqual(20 + 59); // 20 backfilled + ~30s at 2 comments/s
        expect(alertSpy).not.toHaveBeenCalled();
    });

    it('clears future comments when seeking backwards', async () => {
        videoTime = 900;
        await vm.resetChat();
        await playFor(2);

        videoTime = 300;
        await vm.resetChat();

        expect(queueIds()).toEqual(idsUpTo(300, 20));
        expect(vm.commentQueue.every((c: any) => Number(c.gid.slice(1)) <= 600)).toBe(true);
    });

    it('backfills on the first tick of playback (initial load / resume)', async () => {
        videoTime = 1200;
        vm.lastTickChatTime = null; // what startPlayback does
        await vm.tick();
        expect(queueIds()).toEqual(idsUpTo(1200.0, 20));
    });

    it('backfills messages older than 60s (quiet chat)', async () => {
        videoTime = 1501 + 300; // inside the 11 minute gap
        await vm.resetChat();
        expect(queueIds()).toEqual(idsUpTo(1501, 20));
    });

    it('respects the backfill count setting', async () => {
        store.settings.chatBackfillCount = 5;
        videoTime = 600;
        await vm.resetChat();
        expect(queueIds()).toEqual(idsUpTo(600, 5));

        store.settings.chatBackfillCount = 0;
        await vm.resetChat();
        expect(queueIds()).toEqual([]);
    });

    it.each([
        ['number', 300],
        ['string from a text input', '300'],
        ['negative', -300],
        ['negative string', '-300'],
    ])('applies a large chat offset (%s) without jumping to the end of chat', async (_label, offset) => {
        const offsetNumber = Number(offset);
        vm.isReady = true;
        videoTime = 700.5;
        vm.chatOffset = offset;
        await vm.resetChat();
        await playFor(5);

        const chatTime = videoTime + offsetNumber;
        expect(queueIds()).toEqual(idsSeekThenPlay(700.5 + offsetNumber, chatTime));
        expect(vm.nextCommentIndex).toBe(findFirstCommentAfter(comments, chatTime));
        expect(vm.nextCommentIndex).toBeLessThan(comments.length - 100);
        expect(alertSpy).not.toHaveBeenCalled();
    });

    it('sync tool adds to a string offset numerically', async () => {
        vm.chatOffset = '0'; // value left by the old text input
        vm.adjustChatOffset(300.1234);
        expect(vm.chatOffset).toBe(300.123);
        vm.adjustChatOffset(-0.123);
        expect(vm.chatOffset).toBe(300);

        vm.chatOffset = '';
        expect(vm.getChatOffset()).toBe(0);
    });

    it('re-places chat when the offset changes during playback', async () => {
        vm.isReady = true;
        videoTime = 600;
        await vm.resetChat();
        expect(queueIds()).toEqual(idsUpTo(600, 20));

        vm.chatOffset = 300;
        await vi.waitFor(() => expect(queueIds()).toEqual(idsUpTo(900, 20)));
    });

    it('renders emotes and badges for backfilled comments', async () => {
        vm.badges.global = { subscriber: { imageURL: 'https://example.com/sub.png' } };
        comments.length = 0;
        comments.push(makeComment(0, 10, {
            message: {
                body: 'hello LUL',
                fragments: [{ text: 'hello ', emoticon: null }, { text: 'LUL', emoticon: { emoticon_id: '425618' } }],
                user_badges: [{ _id: 'subscriber', version: '6' }],
                user_color: '#00FF7F',
            },
        }));
        vm.commentAmount = 1;

        videoTime = 500;
        await vm.resetChat();
        await wrapper.vm.$nextTick();

        expect(queueIds()).toEqual(['c0']);
        expect(wrapper.findComponent(ChatEmote).props().emote?.name).toBe('LUL');
        expect(wrapper.findComponent(ChatBadge).exists()).toBe(true);
    });

    it('reaches every comment exactly once when played through', async () => {
        vm.commentLimit = 100000;
        comments.splice(400); // first 200s
        vm.commentAmount = comments.length;
        videoTime = 0;
        vm.lastTickChatTime = null;
        await playFor(220);
        const ids = queueIds();
        expect(ids).toEqual(comments.map((c) => c._id));
    });

});
