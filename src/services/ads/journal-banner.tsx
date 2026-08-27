import { useEffect, useMemo, useState } from 'react'
import {
	Dimensions,
	StyleSheet,
	View,
	type LayoutChangeEvent,
	type StyleProp,
	type ViewStyle,
} from 'react-native'
import {
	BANNER_MAX_HEIGHT_DP,
	type BannerPlacementId,
} from '@/config/ads-config'
import { getAnalyticsService } from '@/services/analytics'
import { getAdService } from './ad-registry'

interface JournalBannerProps {
	/** When false, nothing renders and no load is attempted. */
	visible: boolean
	placement: BannerPlacementId
	/** Remount key (e.g. active vehicle id). */
	remountKey: string
	style?: StyleProp<ViewStyle>
}

type YandexSdk = typeof import('yandex-mobile-ads')
type BannerAdSizeInstance = Awaited<
	ReturnType<YandexSdk['BannerAdSize']['inlineSize']>
>
type BannerViewComponent = YandexSdk['BannerView']

/**
 * Inline adaptive banner slot. Isolates yandex-mobile-ads from product screens.
 * Fail-open: load errors collapse the slot (no empty hole).
 */
export function JournalBanner({
	visible,
	placement,
	remountKey,
	style,
}: JournalBannerProps) {
	const ads = getAdService()
	const adUnitId = ads.shouldShowBanner(placement)
		? ads.getBannerAdUnitId(placement)
		: null

	const [containerWidth, setContainerWidth] = useState(
		() => Dimensions.get('window').width,
	)
	const [adSize, setAdSize] = useState<BannerAdSizeInstance | null>(null)
	const [loadFailed, setLoadFailed] = useState(false)
	const [loaded, setLoaded] = useState(false)
	const [BannerView, setBannerView] = useState<BannerViewComponent | null>(null)

	const context = useMemo(() => {
		if (!visible || !adUnitId) {
			return null
		}
		return { placement, remountKey }
	}, [visible, adUnitId, placement, remountKey])

	useEffect(() => {
		if (!context || !adUnitId) {
			return
		}

		let cancelled = false

		async function prepare() {
			try {
				await ads.initialize()
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				const sdk = require('yandex-mobile-ads') as YandexSdk
				const size = await sdk.BannerAdSize.inlineSize(
					containerWidth,
					BANNER_MAX_HEIGHT_DP,
				)
				if (cancelled) {
					return
				}
				setBannerView(() => sdk.BannerView)
				setAdSize(size)
				getAnalyticsService().track('ad_banner_load_requested', {
					placement,
					format: 'banner',
					mode: 'journal',
				})
			} catch {
				if (!cancelled) {
					setLoadFailed(true)
					getAnalyticsService().track('ad_banner_failed', {
						placement,
						format: 'banner',
						mode: 'journal',
						error_category: 'sdk',
					})
				}
			}
		}

		void prepare()
		return () => {
			cancelled = true
		}
	}, [context, adUnitId, containerWidth, ads, placement])

	const handleLayout = (event: LayoutChangeEvent) => {
		const nextWidth = Math.floor(event.nativeEvent.layout.width)
		if (nextWidth > 0 && nextWidth !== containerWidth) {
			setContainerWidth(nextWidth)
		}
	}

	if (!visible || !adUnitId || loadFailed || !context) {
		return null
	}

	// Collapse until size is ready — avoid a blank 90dp hole on failure/slow load.
	if (!BannerView || !adSize) {
		return (
			<View
				onLayout={handleLayout}
				style={[styles.slot, { minHeight: 0 }, style]}
			/>
		)
	}

	return (
		<View
			accessibilityElementsHidden={!loaded}
			importantForAccessibility={loaded ? 'yes' : 'no-hide-descendants'}
			onLayout={handleLayout}
			style={[
				styles.slot,
				{ minHeight: adSize.height },
				style,
			]}
		>
			<BannerView
				adRequest={{ adUnitId }}
				key={`${placement}:${remountKey}:${adUnitId}:${adSize.width}`}
				onAdFailedToLoad={() => {
					setLoadFailed(true)
					getAnalyticsService().track('ad_banner_failed', {
						placement,
						format: 'banner',
						mode: 'journal',
						error_category: 'load',
					})
				}}
				onAdImpression={() => {
					getAnalyticsService().track('ad_banner_impression', {
						placement,
						format: 'banner',
						mode: 'journal',
					})
				}}
				onAdLoaded={() => {
					setLoaded(true)
					getAnalyticsService().track('ad_banner_loaded', {
						placement,
						format: 'banner',
						mode: 'journal',
					})
				}}
				size={adSize}
				style={{
					alignSelf: 'center',
					height: adSize.height,
					width: adSize.width,
				}}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	slot: {
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: 12,
		overflow: 'hidden',
		width: '100%',
	},
})
