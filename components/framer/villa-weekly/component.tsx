import React, { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { ControlType } from "framer"
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react"
import { BooklaSDK } from "https://esm.sh/@bookla-app/react-client-sdk@0.6.2"

//@ts-ignore
import { useRouter } from "framer"

/* ============================== Defaults ============================== */
const DEFAULTS = {
    API_REGION: "eu" as "us" | "eu",
    API_KEY: "",
    COMPANY_ID: "",
    SERVICE_ID: "",
    RESOURCE_ID: "",

    // list layout
    VISIBLE_MONTHS: 3,
    WEEKS_PER_ROW: 3,

    // duration controls
    LENGTH_MODE: "weeks" as "weeks" | "days",

    // weeks mode start weekday (no "any" for this component)
    WEEKS_START_RULE: "sunday" as WeekdayName,

    // days mode
    DAYS_START_RULE: "any" as DaysStartRule,
    DAYS_BASE_LENGTH: 7,
    DAYS_MAX_TOTAL: 28,
    FIXED_LENGTH_DAYS: 0,

    // locale
    LOCALE: "en",

    // card hint text
    WEEKS_HINT_TEXT: "1 week (7 nights)",
    DAYS_HINT_TEXT: "Click to select {days}-day period",

    // design
    DESIGN: {
        gridGap: 12,
        cardRadius: 12,
        cardPadding: 14,
        cardBorderColor: "#e5e5e5",
        cardBorderWidth: 1,
        cardShadow: true,

        stripeEnabled: true,
        stripeColorA: "rgba(0,0,0,0.06)",
        stripeColorB: "rgba(255,255,255,0.06)",
        stripeAngle: 135,
        stripeSize: 8,
        stripeOpacity: 0.9,

        pillRadius: 999,
        buttonRadius: 12,
        buttonPaddingV: 14,
    },

    // form texts
    FORM: {
        title: "Guest details",
        subtitle: "Please fill in your details",
        firstNameLabel: "First name",
        lastNameLabel: "Last name",
        emailLabel: "Email",
        firstNameRequired: true,
        lastNameRequired: false,
        emailRequired: true,
        continueLabel: "Continue",
        bookNowLabel: "Book now",
    },

    // terms
    TERMS: {
        text: "I accept the",
        highlightedText: "terms and conditions",
        termsLink: "https://example.com/terms",
    },

    // UI texts
    TEXTS: {
        // Navigation
        previousMonth: "Previous month",
        nextMonth: "Next month",
        close: "Close",

        // Duration instructions
        weeksStartDayInstruction:
            "Start day must be {weekday}. Click on weeks to select your stay. You can select multiple consecutive weeks.",
        daysStartDayAnyInstruction:
            "Start day can be any. Choose length below.",
        daysStartDayFixedInstruction:
            "Start day must be {weekday}. Choose length below.",

        // Selection display
        checkIn: "Check-in",
        checkOut: "Check-out",
        duration: "Duration",
        day: "day",
        days: "days",

        // Price
        fetchingPrice: "Fetching price…",
        priceLabel: "Price for selected period:",

        // Success
        bookingRequestedTitle: "Booking requested",
        bookingRequestedMessage:
            "We've received your request. You'll get a confirmation or payment step next.",

        // Errors
        missingConfig:
            "Missing Bookla config (API key / company / service / resource).",
        availabilityError: "Failed to load availability.",
        firstNameRequired: "Please enter your first name.",
        lastNameRequired: "Please enter your last name.",
        emailRequired: "Please enter your email.",
        noSlotFound: "No available slot found for the selected dates.",
        bookingFailed:
            "Booking failed. Please try a different date or contact support.",
    },
}

type Size = "sm" | "md" | "lg"
const scale = (n: number, size: Size) =>
    n * (size === "sm" ? 0.85 : size === "lg" ? 1.15 : 1)

type WeekdayName =
    | "sunday"
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"

type DaysStartRule = "any" | WeekdayName

const weekdayToIndex: Record<WeekdayName, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
}

/* ============================== Custom Hooks ============================== */

function useResponsive() {
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== "undefined" ? window.innerWidth < 640 : false
    )
    const [isTablet, setIsTablet] = useState(() =>
        typeof window !== "undefined"
            ? window.innerWidth >= 640 && window.innerWidth < 1024
            : false
    )

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 640)
            setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024)
        }
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [])

    return { isMobile, isTablet }
}

function useBookla(region: "us" | "eu", key: string) {
    const apiUrl = `https://${region}.bookla.com/api`
    return useMemo(
        () =>
            new BooklaSDK({
                apiUrl,
                apiKey: key,
                debug: false,
                retry: {
                    maxAttempts: 3,
                    delayMs: 700,
                    statusCodesToRetry: [408, 429, 500, 502, 503, 504],
                },
            }),
        [region, key]
    )
}

/* ============================== Props ============================== */

type Step = "list" | "form" | "success"

interface ClientData {
    firstName: string
    lastName: string
    email: string
}

type CustomFieldType =
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "multiselect"
    | "phone"
    | "url"

interface CustomFormField {
    labelText: string
    type: CustomFieldType
    placeholderText?: string
    inputWidth?: "auto / span 1" | "auto / span 2"
    required?: boolean
    options?: string
}

interface DesignProps {
    gridGap?: number
    cardRadius?: number
    cardPadding?: number
    cardBorderColor?: string
    cardBorderWidth?: number
    cardShadow?: boolean
    stripeEnabled?: boolean
    stripeColorA?: string
    stripeColorB?: string
    stripeAngle?: number
    stripeSize?: number
    stripeOpacity?: number
    pillRadius?: number
    buttonRadius?: number
    buttonPaddingV?: number
}

interface FormTexts {
    title?: string
    subtitle?: string
    firstNameLabel?: string
    lastNameLabel?: string
    emailLabel?: string
    firstNameRequired?: boolean
    lastNameRequired?: boolean
    emailRequired?: boolean
    continueLabel?: string
    bookNowLabel?: string
}

interface UITexts {
    // Navigation
    previousMonth?: string
    nextMonth?: string
    close?: string

    // Duration instructions
    daysStartDayAnyInstruction?: string
    daysStartDayFixedInstruction?: string

    // Selection display
    checkIn?: string
    checkOut?: string
    duration?: string
    day?: string
    days?: string

    // Price
    fetchingPrice?: string
    priceLabel?: string

    // Success
    bookingRequestedTitle?: string
    bookingRequestedMessage?: string

    // Errors
    missingConfig?: string
    availabilityError?: string
    firstNameRequired?: string
    lastNameRequired?: string
    emailRequired?: string
    noSlotFound?: string
    bookingFailed?: string
}

interface Props {
    // visuals
    size?: Size
    primaryColor?: string
    backgroundColor?: string
    buttonBg?: string
    buttonText?: string
    fontFamily?: string

    // layout
    visibleMonths?: number
    weeksPerRow?: number

    // mode
    lengthMode?: "weeks" | "days"

    // weeks start rule (weekday only)
    weeksStartRule?: WeekdayName

    // days mode
    daysStartRule?: DaysStartRule
    daysBaseLength?: number
    daysMaxTotal?: number
    fixedLengthDays?: number

    // locale
    locale?: string

    // Bookla
    bkla?: { apiRegion?: "us" | "eu"; apiKey?: string; companyID?: string }
    serviceID?: string
    resourceID?: string

    // routes
    routes?: { confirmed?: string; pending?: string }

    // list view hints
    weeksHintText?: string
    daysHintText?: string

    // design
    design?: DesignProps

    // form
    formTexts?: FormTexts
    customForm?: { fields?: CustomFormField[] }

    // UI texts
    texts?: UITexts

    // modal
    modalMode?: "fullscreen" | "contained"

    // terms
    // terms and conditions
    showTerms?: boolean
    terms?: {
        text?: string
        highlightedText?: string
        termsLink?: string
    }
}

/* ============================== Helpers ============================== */

const formatPrice = (amount: number, currency: string, locale: string = "en") =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(
        amount / 100
    )

const addAlpha = (color: string, opacity: number): string => {
    // If already rgba, replace the alpha value
    if (color.startsWith("rgba")) {
        return color.replace(/[\d.]+\)$/g, `${opacity})`)
    }

    // If rgb, convert to rgba
    if (color.startsWith("rgb")) {
        return color.replace("rgb", "rgba").replace(")", `, ${opacity})`)
    }

    // If hex color
    if (color.startsWith("#")) {
        const hex = color.replace("#", "")
        let r, g, b

        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16)
            g = parseInt(hex[1] + hex[1], 16)
            b = parseInt(hex[2] + hex[2], 16)
        } else {
            r = parseInt(hex.substring(0, 2), 16)
            g = parseInt(hex.substring(2, 4), 16)
            b = parseInt(hex.substring(4, 6), 16)
        }

        return `rgba(${r}, ${g}, ${b}, ${opacity})`
    }

    // Fallback
    return `rgba(0, 0, 0, ${opacity})`
}

function findRouteId(allRoutes: any, path: string) {
    if (!allRoutes) return ""
    for (const [key, value] of Object.entries(allRoutes)) {
        // @ts-ignore
        if ((value as any)?.path === path) return key
    }
    return ""
}

const fmt = (d: Date) => d.toISOString().split("T")[0]
const addDays = (d: Date, n: number) => {
    const x = new Date(d)
    x.setDate(x.getDate() + n)
    return x
}
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

/* ============================== Skeleton Loader ============================== */
const SkeletonCard: React.FC<{ design: Required<DesignProps> }> = ({
                                                                       design,
                                                                   }) => (
    <div
        style={{
            height: 120,
            borderRadius: design.cardRadius,
            background:
                "linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite",
        }}
    />
)

/* ============================== Component ============================== */

export default function VillaBookingComponent(_props: Props) {
    const props = _props || {}
    const { isMobile, isTablet } = useResponsive()

    // Bookla config
    const bk = {
        apiRegion:
            (props.bkla?.apiRegion as "us" | "eu") || DEFAULTS.API_REGION,
        apiKey: props.bkla?.apiKey || DEFAULTS.API_KEY,
        companyID: props.bkla?.companyID || DEFAULTS.COMPANY_ID,
    }
    const serviceID = props.serviceID || DEFAULTS.SERVICE_ID
    const resourceID = props.resourceID || DEFAULTS.RESOURCE_ID
    const bookla = useBookla(bk.apiRegion, bk.apiKey)

    // router (optional)
    const { navigate, routes } = useRouter?.() || {
        navigate: undefined,
        routes: undefined,
    }

    // visuals
    const size: Size = props.size || "md"
    const primary = props.primaryColor || "#111"
    const bg = props.backgroundColor || "#fff"
    const btn = props.buttonBg || "#000"
    const btnText = props.buttonText || "#fff"
    const font =
        props.fontFamily ||
        "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial"

    // locale
    const locale = props.locale || DEFAULTS.LOCALE

    // design
    const design: Required<DesignProps> = {
        ...DEFAULTS.DESIGN,
        ...(props.design || {}),
    } as Required<DesignProps>

    // layout & mode
    const visibleMonths = Math.min(
        12,
        Math.max(1, props.visibleMonths ?? DEFAULTS.VISIBLE_MONTHS)
    )
    const weeksPerRow = Math.min(
        6,
        Math.max(1, props.weeksPerRow ?? DEFAULTS.WEEKS_PER_ROW)
    )
    const lengthMode = props.lengthMode ?? DEFAULTS.LENGTH_MODE

    // weeks: creator can choose weekday (no "any")
    const weeksStartRule: WeekdayName =
        props.weeksStartRule ?? DEFAULTS.WEEKS_START_RULE

    // days
    const daysStartRule: DaysStartRule =
        props.daysStartRule ?? DEFAULTS.DAYS_START_RULE
    const baseDays = Math.min(
        31,
        Math.max(
            1,
            Math.floor(props.daysBaseLength ?? DEFAULTS.DAYS_BASE_LENGTH)
        )
    )
    const maxTotalDays = Math.min(
        365,
        Math.max(
            baseDays,
            Math.floor(props.daysMaxTotal ?? DEFAULTS.DAYS_MAX_TOTAL)
        )
    )
    const fixedLengthDays = Math.max(
        0,
        Math.floor(props.fixedLengthDays ?? DEFAULTS.FIXED_LENGTH_DAYS)
    )

    // form texts
    const formTexts: Required<FormTexts> = {
        ...DEFAULTS.FORM,
        ...(props.formTexts || {}),
    } as Required<FormTexts>

    // UI texts
    const texts: Required<UITexts> = {
        ...DEFAULTS.TEXTS,
        ...(props.texts || {}),
    } as Required<UITexts>

    // modal mode
    const modalMode = props.modalMode || "contained"

    // state
    const [step, setStep] = useState<Step>("list")
    const [currentMonth, setCurrentMonth] = useState(() => {
        const d = new Date()
        d.setDate(1)
        return d
    })
    const [availableDates, setAvailableDates] = useState<string[]>([])
    const [startDate, setStartDate] = useState<Date | null>(null)
    const [endDate, setEndDate] = useState<Date | null>(null)
    const [days, setDays] = useState<number>(baseDays)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [hoveredCard, setHoveredCard] = useState<string | null>(null)
    const [expandedMonths, setExpandedMonths] = useState<Set<number>>(
        new Set([0])
    )

    // price & slot
    const [price, setPrice] = useState<{
        amount: number
        currency: string
    } | null>(null)
    const [priceLoading, setPriceLoading] = useState(false)
    const lastPriceKeyRef = useRef<string | null>(null)
    const [slotStartISO, setSlotStartISO] = useState<string | null>(null)

    // client + custom form
    const [client, setClient] = useState<ClientData>({
        firstName: "",
        lastName: "",
        email: "",
    })
    const [customData, setCustomData] = useState<Record<string, any>>({})

    const showTerms = props.showTerms ?? false
    const termsConfig = {
        text: props.terms?.text ?? DEFAULTS.TERMS.text,
        highlightedText:
            props.terms?.highlightedText ?? DEFAULTS.TERMS.highlightedText,
        termsLink: props.terms?.termsLink ?? DEFAULTS.TERMS.termsLink,
    }

    // derived selection length
    const selectedDays = useMemo(() => {
        if (lengthMode === "weeks") {
            if (!startDate || !endDate) return 7 // default to 1 week

            // Calculate days properly to avoid DST issues
            // Normalize both dates to midnight to ensure accurate day count
            const start = new Date(startDate)
            start.setHours(0, 0, 0, 0)
            const end = new Date(endDate)
            end.setHours(0, 0, 0, 0)

            const diffTime = end.getTime() - start.getTime()
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
            return diffDays
        }
        return fixedLengthDays > 0 ? fixedLengthDays : days
    }, [lengthMode, startDate, endDate, fixedLengthDays, days])

    const dayMultiples = useMemo(() => {
        if (fixedLengthDays > 0 && lengthMode === "days")
            return [fixedLengthDays]
        const out: number[] = []
        let n = baseDays
        while (n <= maxTotalDays) {
            out.push(n)
            n += baseDays
        }
        return out
    }, [baseDays, maxTotalDays, fixedLengthDays, lengthMode])

    useEffect(() => {
        if (
            lengthMode === "days" &&
            dayMultiples.length > 0 &&
            !dayMultiples.includes(days)
        ) {
            setDays(dayMultiples[0])
        }
    }, [dayMultiples, lengthMode])

    const endBoundary = useMemo(() => {
        if (lengthMode === "weeks") {
            return endDate
        }
        return startDate ? addDays(startDate, selectedDays) : null
    }, [lengthMode, startDate, endDate, selectedDays])

    const [termsAccepted, setTermsAccepted] = useState(false)

    const isAvailableDay = (d: Date) => availableDates.includes(fmt(d))
    const isSpanAvailable = (s: Date, e: Date) => {
        const cur = new Date(s)
        // Check up to but not including end date (end is checkout day)
        while (cur < e) {
            if (!availableDates.includes(fmt(cur))) return false
            cur.setDate(cur.getDate() + 1)
        }
        return true
    }

    const isAllowedStartWeekdayWeeks = (d: Date) =>
        d.getDay() === weekdayToIndex[weeksStartRule]
    const isAllowedStartWeekdayDays = (d: Date) =>
        daysStartRule === "any"
            ? true
            : d.getDay() === weekdayToIndex[daysStartRule]

    /* -------- Availability (service type: days) -------- */
    const fetchAvailability = useCallback(
        async (anchor: Date, months: number) => {
            setLoading(true)
            setError(null)
            try {
                const first = new Date(
                    anchor.getFullYear(),
                    anchor.getMonth(),
                    1
                )
                const last = new Date(
                    anchor.getFullYear(),
                    anchor.getMonth() + months,
                    0
                )
                const res = await (bookla as any).services.getDates(
                    bk.companyID,
                    serviceID,
                    {
                        from: first.toISOString(),
                        to: last.toISOString(),
                        duration: "P1D",
                        resourceIDs: [resourceID],
                    }
                )
                const s = new Set<string>()
                Object.values(res.dates).forEach((arr: any) =>
                    (arr as string[]).forEach((d) => s.add(d))
                )
                setAvailableDates(Array.from(s).sort())
            } catch (e) {
                console.error(e)
                setError(texts.availabilityError)
            } finally {
                setLoading(false)
            }
        },
        [bookla, bk.companyID, serviceID, resourceID]
    )

    useEffect(() => {
        fetchAvailability(currentMonth, visibleMonths)
    }, [currentMonth, visibleMonths, fetchAvailability])

    /* -------- Price + slot for selected span -------- */
    const fetchPriceAndSlot = useCallback(async () => {
        if (!startDate || !endBoundary) return
        const key = `${fmt(startDate)}|${selectedDays}`
        if (lastPriceKeyRef.current === key && price && slotStartISO) return
        lastPriceKeyRef.current = key
        setPriceLoading(true)
        setSlotStartISO(null)
        setPrice(null)
        try {
            const res = await (bookla as any).services.getTimes(
                bk.companyID,
                serviceID,
                {
                    from: startDate.toISOString(),
                    to: endBoundary.toISOString(),
                    duration: `P${selectedDays}D`,
                    resourceIDs: [resourceID],
                }
            )
            const times = (res as any).times || {}
            const slots: any[] = times[resourceID] || []
            const targetDateStr = fmt(startDate)
            let chosen: any = null
            for (const s of slots) {
                try {
                    const isoStr = new Date(s.startTime).toISOString()
                    if (isoStr.startsWith(targetDateStr)) {
                        chosen = s
                        break
                    }
                } catch {}
            }
            if (!chosen && slots.length > 0) chosen = slots[0]
            if (chosen) {
                if (
                    chosen.price &&
                    typeof chosen.price.amount === "number" &&
                    chosen.price.currency
                ) {
                    setPrice({
                        amount: chosen.price.amount,
                        currency: chosen.price.currency,
                    })
                }
                if (chosen.startTime)
                    setSlotStartISO(new Date(chosen.startTime).toISOString())
            }
        } catch (e) {
            console.warn("Price/slot lookup failed", e)
        } finally {
            setPriceLoading(false)
        }
    }, [
        startDate,
        endBoundary,
        selectedDays,
        bookla,
        bk.companyID,
        serviceID,
        resourceID,
        price,
        slotStartISO,
    ])

    useEffect(() => {
        if (
            startDate &&
            endBoundary &&
            isSpanAvailable(startDate, endBoundary)
        ) {
            fetchPriceAndSlot()
        }
    }, [startDate, endBoundary, fetchPriceAndSlot])

    const onContinue = () => {
        if (startDate && endBoundary && isSpanAvailable(startDate, endBoundary))
            setStep("form")
    }

    const onBook = async () => {
        if (!startDate || !endBoundary) return
        if (formTexts.firstNameRequired && !client.firstName)
            return setError(texts.firstNameRequired)
        if (formTexts.lastNameRequired && !client.lastName)
            return setError(texts.lastNameRequired)
        if (formTexts.emailRequired && !client.email)
            return setError(texts.emailRequired)
        if (!slotStartISO) return setError(texts.noSlotFound)
        // Check terms acceptance if enabled
        if (showTerms && !termsAccepted) {
            return setError("Please accept the terms and conditions")
        }

        setError(null)
        try {
            const body: any = {
                companyID: bk.companyID,
                serviceID,
                resourceID,
                startTime: slotStartISO,
                duration: `P${selectedDays}D`,
                client: { ...client },
            }
            if (Object.keys(customData).length > 0) body.metaData = customData

            const res = await (bookla as any).bookings.request(body)

            if (res?.paymentURL) {
                window.location.href = res.paymentURL
                return
            }
            if (navigate && props.routes) {
                if (res?.status === "confirmed" && props.routes.confirmed) {
                    const rid =
                        findRouteId(routes, props.routes.confirmed) ||
                        findRouteId(routes, "/")
                    if (rid) return navigate(rid, "")
                }
                if (res?.status === "pending" && props.routes.pending) {
                    const rid =
                        findRouteId(routes, props.routes.pending) ||
                        findRouteId(routes, "/")
                    if (rid) return navigate(rid, "")
                }
            }
            setStep("success")
        } catch (e) {
            console.error(e)
            setError(texts.bookingFailed)
        }
    }

    /* -------- List helpers -------- */
    const startOfWeekBy = useCallback((d: Date, anchor: WeekdayName) => {
        const idx = weekdayToIndex[anchor]
        const diff = (d.getDay() - idx + 7) % 7
        const out = new Date(d)
        out.setHours(0, 0, 0, 0)
        out.setDate(out.getDate() - diff)
        return out
    }, [])

    // Helper to check if two dates are the same day
    const isSameDay = (d1: Date, d2: Date) => {
        return (
            d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate()
        )
    }

    // Helper to check if a week is adjacent to current selection
    const isWeekAdjacent = (weekStart: Date, weekEnd: Date) => {
        if (!startDate || !endDate) return false

        // Check if this week's start is the same as current selection's end (Sunday to Sunday)
        if (isSameDay(weekStart, endDate)) return true

        // Check if this week's end is the same as current selection's start
        if (isSameDay(weekEnd, startDate)) return true

        return false
    }

    // Helper to check if a week is within current selection
    const isWeekInSelection = (weekStart: Date, weekEnd: Date) => {
        if (!startDate || !endDate) return false
        return weekStart >= startDate && weekEnd <= endDate
    }

    // Handle week selection
    const handleWeekSelect = (weekStart: Date, weekEnd: Date) => {
        if (!startDate || !endDate) {
            // First selection
            setStartDate(weekStart)
            setEndDate(weekEnd)
            setPrice(null)
            setSlotStartISO(null)
            lastPriceKeyRef.current = null
            setError(null)
        } else if (isWeekInSelection(weekStart, weekEnd)) {
            // Clicking on a week within selection - deselect

            // Check if this is the only selected week
            if (
                isSameDay(startDate, weekStart) &&
                isSameDay(endDate, weekEnd)
            ) {
                // Only one week selected - clear selection
                setStartDate(null)
                setEndDate(null)
                setPrice(null)
                setSlotStartISO(null)
                lastPriceKeyRef.current = null
                setError(null)
            } else if (isSameDay(startDate, weekStart)) {
                // Deselecting the first week - move start forward
                setStartDate(weekEnd)
                setPrice(null)
                setSlotStartISO(null)
                lastPriceKeyRef.current = null
                setError(null)
            } else if (isSameDay(endDate, weekEnd)) {
                // Deselecting the last week - move end backward
                setEndDate(weekStart)
                setPrice(null)
                setSlotStartISO(null)
                lastPriceKeyRef.current = null
                setError(null)
            } else {
                // Deselecting a middle week - clear all selection
                setStartDate(null)
                setEndDate(null)
                setPrice(null)
                setSlotStartISO(null)
                lastPriceKeyRef.current = null
                setError(null)
            }
        } else if (isWeekAdjacent(weekStart, weekEnd)) {
            // Extend selection
            const newStart = weekStart < startDate ? weekStart : startDate
            const newEnd = weekEnd > endDate ? weekEnd : endDate
            setStartDate(newStart)
            setEndDate(newEnd)
            setPrice(null)
            setSlotStartISO(null)
            lastPriceKeyRef.current = null
            setError(null)
        } else {
            // Non-adjacent week - start new selection
            setStartDate(weekStart)
            setEndDate(weekEnd)
            setPrice(null)
            setSlotStartISO(null)
            lastPriceKeyRef.current = null
            setError(null)
        }
    }

    type RowItem = {
        start: Date
        end: Date
        key: string
        baseAvailable: boolean
    }

    const buildRowsForMonth = useCallback(
        (monthStart: Date): RowItem[] => {
            const rows: RowItem[] = []
            const y = monthStart.getFullYear()
            const m = monthStart.getMonth()
            const first = new Date(y, m, 1)
            const last = new Date(y, m + 1, 0)

            for (
                let d = new Date(first);
                d <= last;
                d.setDate(d.getDate() + 1)
            ) {
                const day = new Date(d)
                const allowed =
                    lengthMode === "weeks"
                        ? isAllowedStartWeekdayWeeks(day)
                        : isAllowedStartWeekdayDays(day)
                if (!allowed) continue

                const start =
                    lengthMode === "weeks"
                        ? startOfWeekBy(day, weeksStartRule)
                        : day

                // For weeks mode, always use 7 days per row
                const baseLen = lengthMode === "weeks" ? 7 : baseDays
                const end = addDays(start, baseLen)

                if (start.getMonth() !== m) continue

                const baseAvailable =
                    isAvailableDay(start) && isSpanAvailable(start, end)
                const key = `${fmt(start)}|${baseLen}`
                if (!rows.find((r) => r.key === key))
                    rows.push({
                        start,
                        end,
                        key,
                        baseAvailable,
                    })
            }
            return rows
        },
        [
            weeksStartRule,
            lengthMode,
            baseDays,
            isAvailableDay,
            isSpanAvailable,
            startOfWeekBy,
            isAllowedStartWeekdayWeeks,
            isAllowedStartWeekdayDays,
        ]
    )

    // Memoize grid columns calculation
    const gridColumns = useMemo(() => {
        if (isMobile) return "1fr"
        if (isTablet) return "repeat(2, 1fr)"
        return `repeat(${weeksPerRow}, minmax(280px, 1fr))`
    }, [isMobile, isTablet, weeksPerRow])

    /* -------- Card -------- */
    const hintTemplate = (props.rowHintText ?? DEFAULTS.ROW_HINT_TEXT) || ""
    const weeksHintTemplate = props.weeksHintText ?? DEFAULTS.WEEKS_HINT_TEXT
    const daysHintTemplate = props.daysHintText ?? DEFAULTS.DAYS_HINT_TEXT

    const RowCard: React.FC<{
        row: RowItem
        selected: boolean
        disabled: boolean
        onSelect: () => void
    }> = ({ row, selected, disabled, onSelect }) => {
        // For weeks mode, show check-in to checkout day (Sunday to Sunday for 7 nights)
        // row.end already contains the checkout day (7 days after start)
        const endDateForDisplay =
            lengthMode === "weeks"
                ? row.end // This is the checkout day (e.g., Sunday to Sunday)
                : addDays(row.start, selectedDays) // For days mode

        const labelStart = row.start.toLocaleDateString(locale, {
            weekday: "short",
            day: "numeric",
            month: "short",
        })
        const labelEnd = endDateForDisplay.toLocaleDateString(locale, {
            weekday: "short",
            day: "numeric",
            month: "short",
        })

        const daysCount = lengthMode === "weeks" ? 7 : selectedDays

        const stripe =
            design.stripeEnabled && disabled
                ? {
                    backgroundImage: `repeating-linear-gradient(${design.stripeAngle}deg, ${design.stripeColorA}, ${design.stripeColorA} ${design.stripeSize}px, ${design.stripeColorB} ${design.stripeSize}px, ${design.stripeColorB} ${design.stripeSize * 2}px)`,
                    opacity: design.stripeOpacity,
                }
                : {}

        const hint =
            lengthMode === "weeks"
                ? weeksHintTemplate
                : daysHintTemplate
                    ? daysHintTemplate.replace("{days}", String(selectedDays))
                    : ""

        const isHovered = hoveredCard === row.key

        return (
            <button
                type="button"
                disabled={disabled}
                onClick={onSelect}
                onMouseEnter={() => !disabled && setHoveredCard(row.key)}
                onMouseLeave={() => setHoveredCard(null)}
                onTouchStart={() => !disabled && setHoveredCard(row.key)}
                onTouchEnd={() => setHoveredCard(null)}
                style={{
                    textAlign: "left",
                    borderRadius: design.cardRadius,
                    border: `${design.cardBorderWidth}px solid ${selected ? "transparent" : design.cardBorderColor}`,
                    background: selected ? primary : "#fff",
                    color: selected ? "#fff" : primary,
                    padding: design.cardPadding,
                    cursor: disabled ? "not-allowed" : "pointer",
                    width: "100%",
                    minHeight: 44, // Touch target
                    transition: "all 200ms ease",
                    boxShadow:
                        isHovered && !disabled
                            ? "0 4px 12px rgba(0,0,0,0.12)"
                            : design.cardShadow
                                ? "0 1px 2px rgba(0,0,0,0.05)"
                                : "none",
                    transform:
                        isHovered && !disabled ? "translateY(-2px)" : "none",
                    position: "relative",
                    ...stripe,
                }}
            >
                <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 16 }}>
                    {labelStart} — {labelEnd}
                </div>
                <div
                    style={{
                        opacity: 0.85,
                        marginTop: 4,
                        fontSize: isMobile ? 13 : 14,
                    }}
                >
                    {hint}
                </div>
            </button>
        )
    }

    /* -------- Render -------- */
    const canContinue =
        !!startDate && !!endBoundary && isSpanAvailable(startDate, endBoundary)

    if (!bk.apiKey || !bk.companyID || !serviceID || !resourceID) {
        return (
            <div style={{ color: "red", fontFamily: font, padding: 16 }}>
                {texts.missingConfig}
            </div>
        )
    }

    // Add keyframes for shimmer animation
    const styleTag = (
        <style>{`
            @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
        `}</style>
    )

    return (
        <>
            {styleTag}
            <div
                style={{
                    background: bg,
                    color: primary,
                    borderRadius: 12,
                    padding: scale(isMobile ? 12 : 18, size),
                    paddingTop: `calc(${scale(isMobile ? 12 : 18, size)}px + env(safe-area-inset-top))`,
                    paddingBottom: `calc(${scale(isMobile ? 12 : 18, size)}px + env(safe-area-inset-bottom))`,
                    paddingLeft: `calc(${scale(isMobile ? 12 : 18, size)}px + env(safe-area-inset-left))`,
                    paddingRight: `calc(${scale(isMobile ? 12 : 18, size)}px + env(safe-area-inset-right))`,
                    fontFamily: font,
                    width: "100%",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    position: modalMode === "contained" ? "relative" : "static",
                }}
            >
                {(step === "list" || step === "form") && (
                    <>
                        {/* Month navigation */}
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 16,
                            }}
                        >
                            <button
                                onClick={() =>
                                    setCurrentMonth(
                                        new Date(
                                            currentMonth.getFullYear(),
                                            currentMonth.getMonth() - 1,
                                            1
                                        )
                                    )
                                }
                                style={{
                                    border: "none",
                                    background: "none",
                                    cursor: "pointer",
                                    minWidth: 44,
                                    minHeight: 44,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: 12,
                                }}
                                aria-label={texts.previousMonth}
                                type="button"
                            >
                                <ChevronLeft size={24} />
                            </button>
                            <div
                                style={{
                                    fontWeight: 700,
                                    fontSize: isMobile ? 16 : 18,
                                }}
                            >
                                {currentMonth.toLocaleDateString(locale, {
                                    month: "long",
                                    year: "numeric",
                                })}
                            </div>
                            <button
                                onClick={() =>
                                    setCurrentMonth(
                                        new Date(
                                            currentMonth.getFullYear(),
                                            currentMonth.getMonth() + 1,
                                            1
                                        )
                                    )
                                }
                                style={{
                                    border: "none",
                                    background: "none",
                                    cursor: "pointer",
                                    minWidth: 44,
                                    minHeight: 44,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: 12,
                                }}
                                aria-label={texts.nextMonth}
                                type="button"
                            >
                                <ChevronRight size={24} />
                            </button>
                        </div>

                        {/* Month rows */}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 24,
                            }}
                        >
                            {loading ? (
                                // Skeleton loading state
                                <div
                                    style={{
                                        display: "grid",
                                        gap: design.gridGap,
                                    }}
                                >
                                    {[1, 2, 3].map((i) => (
                                        <SkeletonCard key={i} design={design} />
                                    ))}
                                </div>
                            ) : (
                                Array.from(
                                    { length: visibleMonths },
                                    (_, i) => {
                                        const monthStart = new Date(
                                            currentMonth.getFullYear(),
                                            currentMonth.getMonth() + i,
                                            1
                                        )
                                        const monthRows =
                                            buildRowsForMonth(monthStart)
                                        const isExpanded = expandedMonths.has(i)

                                        return (
                                            <div key={`m-${i}`}>
                                                {isMobile ? (
                                                    // Collapsible on mobile
                                                    <details
                                                        open={isExpanded}
                                                        onToggle={(e: any) => {
                                                            const newExpanded =
                                                                new Set(
                                                                    expandedMonths
                                                                )
                                                            if (e.target.open) {
                                                                newExpanded.add(
                                                                    i
                                                                )
                                                            } else {
                                                                newExpanded.delete(
                                                                    i
                                                                )
                                                            }
                                                            setExpandedMonths(
                                                                newExpanded
                                                            )
                                                        }}
                                                    >
                                                        <summary
                                                            style={{
                                                                fontWeight: 800,
                                                                marginBottom: 10,
                                                                cursor: "pointer",
                                                                listStyle:
                                                                    "none",
                                                                display: "flex",
                                                                justifyContent:
                                                                    "space-between",
                                                                alignItems:
                                                                    "center",
                                                                padding:
                                                                    "8px 0",
                                                            }}
                                                        >
                                                            <span>
                                                                {monthStart.toLocaleDateString(
                                                                    locale,
                                                                    {
                                                                        month: "long",
                                                                        year: "numeric",
                                                                    }
                                                                )}
                                                            </span>
                                                            <ChevronRight
                                                                size={20}
                                                                style={{
                                                                    transform:
                                                                        isExpanded
                                                                            ? "rotate(90deg)"
                                                                            : "none",
                                                                    transition:
                                                                        "transform 200ms",
                                                                }}
                                                            />
                                                        </summary>
                                                        <div
                                                            style={{
                                                                display: "grid",
                                                                gridTemplateColumns:
                                                                gridColumns,
                                                                gap: design.gridGap,
                                                                alignItems:
                                                                    "stretch",
                                                            }}
                                                        >
                                                            {monthRows.map(
                                                                (row) => {
                                                                    const spanUnavailable =
                                                                        lengthMode ===
                                                                        "weeks"
                                                                            ? !isSpanAvailable(
                                                                                row.start,
                                                                                row.end
                                                                            )
                                                                            : !isSpanAvailable(
                                                                                row.start,
                                                                                addDays(
                                                                                    row.start,
                                                                                    selectedDays
                                                                                )
                                                                            )

                                                                    let weekStartsInPast =
                                                                        false
                                                                    if (
                                                                        lengthMode ===
                                                                        "weeks"
                                                                    ) {
                                                                        const weekStart =
                                                                            startOfWeekBy(
                                                                                row.start,
                                                                                weeksStartRule
                                                                            )
                                                                        const today =
                                                                            new Date()
                                                                        today.setHours(
                                                                            0,
                                                                            0,
                                                                            0,
                                                                            0
                                                                        )
                                                                        weekStartsInPast =
                                                                            weekStart <
                                                                            today
                                                                    }
                                                                    const disabled =
                                                                        spanUnavailable ||
                                                                        weekStartsInPast

                                                                    const isSelected =
                                                                        lengthMode ===
                                                                        "weeks"
                                                                            ? isWeekInSelection(
                                                                                row.start,
                                                                                row.end
                                                                            )
                                                                            : !!startDate &&
                                                                            sameDay(
                                                                                row.start,
                                                                                startDate
                                                                            ) &&
                                                                            endBoundary &&
                                                                            sameDay(
                                                                                addDays(
                                                                                    row.start,
                                                                                    selectedDays
                                                                                ),
                                                                                endBoundary
                                                                            )

                                                                    return (
                                                                        <RowCard
                                                                            key={`${fmt(row.start)}|${lengthMode === "weeks" ? 7 : selectedDays}`}
                                                                            row={
                                                                                row
                                                                            }
                                                                            selected={
                                                                                isSelected
                                                                            }
                                                                            disabled={
                                                                                disabled
                                                                            }
                                                                            onSelect={() => {
                                                                                if (
                                                                                    disabled
                                                                                )
                                                                                    return
                                                                                if (
                                                                                    lengthMode ===
                                                                                    "weeks"
                                                                                ) {
                                                                                    handleWeekSelect(
                                                                                        row.start,
                                                                                        row.end
                                                                                    )
                                                                                } else {
                                                                                    setStartDate(
                                                                                        row.start
                                                                                    )
                                                                                    setEndDate(
                                                                                        null
                                                                                    )
                                                                                    setPrice(
                                                                                        null
                                                                                    )
                                                                                    setSlotStartISO(
                                                                                        null
                                                                                    )
                                                                                    lastPriceKeyRef.current =
                                                                                        null
                                                                                    setError(
                                                                                        null
                                                                                    )
                                                                                }
                                                                            }}
                                                                        />
                                                                    )
                                                                }
                                                            )}
                                                        </div>
                                                    </details>
                                                ) : (
                                                    // Regular view on desktop
                                                    <>
                                                        <div
                                                            style={{
                                                                fontWeight: 800,
                                                                marginBottom: 10,
                                                            }}
                                                        >
                                                            {monthStart.toLocaleDateString(
                                                                locale,
                                                                {
                                                                    month: "long",
                                                                    year: "numeric",
                                                                }
                                                            )}
                                                        </div>

                                                        <div
                                                            style={{
                                                                display: "grid",
                                                                gridTemplateColumns:
                                                                gridColumns,
                                                                gap: design.gridGap,
                                                                alignItems:
                                                                    "stretch",
                                                            }}
                                                        >
                                                            {monthRows.map(
                                                                (row) => {
                                                                    const spanUnavailable =
                                                                        lengthMode ===
                                                                        "weeks"
                                                                            ? !isSpanAvailable(
                                                                                row.start,
                                                                                row.end
                                                                            )
                                                                            : !isSpanAvailable(
                                                                                row.start,
                                                                                addDays(
                                                                                    row.start,
                                                                                    selectedDays
                                                                                )
                                                                            )

                                                                    let weekStartsInPast =
                                                                        false
                                                                    if (
                                                                        lengthMode ===
                                                                        "weeks"
                                                                    ) {
                                                                        const weekStart =
                                                                            startOfWeekBy(
                                                                                row.start,
                                                                                weeksStartRule
                                                                            )
                                                                        const today =
                                                                            new Date()
                                                                        today.setHours(
                                                                            0,
                                                                            0,
                                                                            0,
                                                                            0
                                                                        )
                                                                        weekStartsInPast =
                                                                            weekStart <
                                                                            today
                                                                    }
                                                                    const disabled =
                                                                        spanUnavailable ||
                                                                        weekStartsInPast

                                                                    const isSelected =
                                                                        lengthMode ===
                                                                        "weeks"
                                                                            ? isWeekInSelection(
                                                                                row.start,
                                                                                row.end
                                                                            )
                                                                            : !!startDate &&
                                                                            sameDay(
                                                                                row.start,
                                                                                startDate
                                                                            ) &&
                                                                            endBoundary &&
                                                                            sameDay(
                                                                                addDays(
                                                                                    row.start,
                                                                                    selectedDays
                                                                                ),
                                                                                endBoundary
                                                                            )

                                                                    return (
                                                                        <RowCard
                                                                            key={`${fmt(row.start)}|${lengthMode === "weeks" ? 7 : selectedDays}`}
                                                                            row={
                                                                                row
                                                                            }
                                                                            selected={
                                                                                isSelected
                                                                            }
                                                                            disabled={
                                                                                disabled
                                                                            }
                                                                            onSelect={() => {
                                                                                if (
                                                                                    disabled
                                                                                )
                                                                                    return
                                                                                if (
                                                                                    lengthMode ===
                                                                                    "weeks"
                                                                                ) {
                                                                                    handleWeekSelect(
                                                                                        row.start,
                                                                                        row.end
                                                                                    )
                                                                                } else {
                                                                                    setStartDate(
                                                                                        row.start
                                                                                    )
                                                                                    setEndDate(
                                                                                        null
                                                                                    )
                                                                                    setPrice(
                                                                                        null
                                                                                    )
                                                                                    setSlotStartISO(
                                                                                        null
                                                                                    )
                                                                                    lastPriceKeyRef.current =
                                                                                        null
                                                                                    setError(
                                                                                        null
                                                                                    )
                                                                                }
                                                                            }}
                                                                        />
                                                                    )
                                                                }
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )
                                    }
                                )
                            )}
                        </div>

                        {/* Duration controls */}
                        <div style={{ marginTop: 20 }}>
                            <div
                                style={{
                                    fontWeight: 600,
                                    marginBottom: 8,
                                    fontSize: isMobile ? 14 : 15,
                                }}
                            >
                                {lengthMode === "weeks"
                                    ? ""
                                    : daysStartRule === "any"
                                        ? texts.daysStartDayAnyInstruction
                                        : texts.daysStartDayFixedInstruction.replace(
                                            "{weekday}",
                                            daysStartRule
                                        )}
                            </div>

                            {/* Only show duration pills for days mode */}
                            {lengthMode === "days" && (
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 8,
                                        flexWrap: isMobile ? "nowrap" : "wrap",
                                        overflowX: isMobile
                                            ? "auto"
                                            : "visible",
                                        paddingBottom: isMobile ? 8 : 0,
                                        scrollbarWidth: "none",
                                        msOverflowStyle: "none",
                                        WebkitOverflowScrolling: "touch",
                                    }}
                                >
                                    {fixedLengthDays > 0 ? (
                                        <button
                                            type="button"
                                            disabled
                                            style={{
                                                border: "1px solid #e5e5e5",
                                                background: primary,
                                                color: "#fff",
                                                padding: isMobile
                                                    ? "12px 18px"
                                                    : "10px 14px",
                                                borderRadius: design.pillRadius,
                                                fontWeight: 700,
                                                fontSize: isMobile ? 15 : 14,
                                                minHeight: 44,
                                            }}
                                        >
                                            {fixedLengthDays}{" "}
                                            {fixedLengthDays > 1
                                                ? texts.days
                                                : texts.day}
                                        </button>
                                    ) : (
                                        dayMultiples.map((d) => (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => {
                                                    setDays(d)
                                                    if (startDate) {
                                                        setPrice(null)
                                                        setSlotStartISO(null)
                                                        lastPriceKeyRef.current =
                                                            null
                                                    }
                                                }}
                                                style={{
                                                    border: "1px solid #e5e5e5",
                                                    background:
                                                        days === d
                                                            ? primary
                                                            : "#fff",
                                                    color:
                                                        days === d
                                                            ? "#fff"
                                                            : primary,
                                                    padding: isMobile
                                                        ? "12px 18px"
                                                        : "10px 14px",
                                                    borderRadius:
                                                    design.pillRadius,
                                                    cursor: "pointer",
                                                    fontWeight: 700,
                                                    fontSize: isMobile
                                                        ? 15
                                                        : 14,
                                                    minWidth: isMobile
                                                        ? "auto"
                                                        : "initial",
                                                    whiteSpace: "nowrap",
                                                    minHeight: 44,
                                                }}
                                            >
                                                {d}{" "}
                                                {d > 1 ? texts.days : texts.day}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                            {startDate && endBoundary && (
                                <div
                                    style={{
                                        fontSize: 13,
                                        opacity: 0.9,
                                        marginTop: 8,
                                    }}
                                >
                                    {priceLoading && (
                                        <span>{texts.fetchingPrice}</span>
                                    )}
                                    {price && !priceLoading && (
                                        <span>
                                            {texts.priceLabel}{" "}
                                            <b>
                                                {formatPrice(
                                                    price.amount,
                                                    price.currency,
                                                    locale
                                                )}
                                            </b>
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Sticky button on mobile */}
                        <div
                            style={{
                                marginTop: 16,
                            }}
                        >
                            <button
                                type="button"
                                onClick={onContinue}
                                disabled={!canContinue || loading}
                                style={{
                                    width: "100%",
                                    background: btn,
                                    color: btnText,
                                    padding: `${design.buttonPaddingV}px 0`,
                                    borderRadius: design.buttonRadius,
                                    border: "none",
                                    cursor:
                                        canContinue && !loading
                                            ? "pointer"
                                            : "not-allowed",
                                    fontWeight: 800,
                                    opacity: canContinue && !loading ? 1 : 0.5,
                                    fontSize: isMobile ? 16 : 15,
                                    minHeight: 48,
                                    transition: "opacity 200ms",
                                }}
                            >
                                {!canContinue
                                    ? formTexts.continueLabel
                                    : priceLoading
                                        ? `${formTexts.continueLabel} – fetching price…`
                                        : price
                                            ? `${formTexts.continueLabel} – ${formatPrice(price.amount, price.currency, locale)}`
                                            : formTexts.continueLabel}
                            </button>
                        </div>

                        {error && (
                            <div
                                role="alert"
                                style={{
                                    color: "#dc2626",
                                    background: "#fee2e2",
                                    padding: 12,
                                    borderRadius: 8,
                                    marginTop: 8,
                                    border: "1px solid #fecaca",
                                    display: "flex",
                                    gap: 8,
                                    alignItems: "flex-start",
                                }}
                            >
                                <AlertCircle
                                    size={18}
                                    style={{ flexShrink: 0 }}
                                />
                                <span style={{ marginTop: 2 }}>{error}</span>
                            </div>
                        )}
                    </>
                )}

                {step === "form" && (
                    <div
                        style={{
                            position:
                                modalMode === "fullscreen"
                                    ? "fixed"
                                    : "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: "rgba(0, 0, 0, 0.4)",
                            backdropFilter: "blur(8px)",
                            WebkitBackdropFilter: "blur(8px)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 1000,
                            padding: isMobile ? 16 : 32,
                            overflowY: "auto",
                            borderRadius: modalMode === "fullscreen" ? 0 : 12,
                        }}
                        onClick={(e) => {
                            // Close modal when clicking backdrop
                            if (e.target === e.currentTarget) {
                                setStep("list")
                            }
                        }}
                    >
                        <div
                            style={{
                                background: bg,
                                borderRadius: 16,
                                maxWidth: 600,
                                width: "100%",
                                maxHeight: "90vh",
                                overflowY: "auto",
                                boxShadow:
                                    "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                                margin: "auto",
                                position: "relative",
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div
                                style={{
                                    display: "grid",
                                    gap: 16,
                                    padding: isMobile
                                        ? "48px 20px 20px"
                                        : "56px 24px 24px",
                                }}
                            >
                                {/* Close button */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep("list")
                                        if (showTerms) setTermsAccepted(false)
                                    }}
                                    style={{
                                        position: "absolute",
                                        top: 16,
                                        right: 16,
                                        border: "none",
                                        background: "rgba(0,0,0,0.05)",
                                        cursor: "pointer",
                                        width: 32,
                                        height: 32,
                                        borderRadius: "50%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: primary,
                                        transition: "background 200ms",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background =
                                            "rgba(0,0,0,0.1)"
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background =
                                            "rgba(0,0,0,0.05)"
                                    }}
                                    aria-label={texts.close}
                                >
                                    <svg
                                        fill="#000000"
                                        width="16px"
                                        height="16px"
                                        viewBox="0 0 1024 1024"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <g
                                            id="SVGRepo_bgCarrier"
                                            stroke-width="0"
                                        ></g>
                                        <g
                                            id="SVGRepo_tracerCarrier"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        ></g>
                                        <g id="SVGRepo_iconCarrier">
                                            <path d="M697.4 759.2l61.8-61.8L573.8 512l185.4-185.4-61.8-61.8L512 450.2 326.6 264.8l-61.8 61.8L450.2 512 264.8 697.4l61.8 61.8L512 573.8z"></path>
                                        </g>
                                    </svg>
                                </button>

                                {/* Booking Summary */}
                                {startDate && endBoundary && (
                                    <div
                                        style={{
                                            background: `linear-gradient(135deg, ${addAlpha(primary, 0.15)} 0%, ${addAlpha(primary, 0.08)} 100%)`,
                                            border: `2px solid ${addAlpha(primary, 0.2)}`,
                                            padding: isMobile ? 20 : 24,
                                            borderRadius: 16,
                                            marginBottom: 8,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: isMobile
                                                    ? "1fr"
                                                    : "1fr auto 1fr",
                                                gap: isMobile ? 16 : 24,
                                                alignItems: "center",
                                            }}
                                        >
                                            <div>
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        opacity: 0.6,
                                                        marginBottom: 6,
                                                        textTransform:
                                                            "uppercase",
                                                        letterSpacing: "0.3px",
                                                    }}
                                                >
                                                    {texts.checkIn}
                                                </div>
                                                <div
                                                    style={{
                                                        fontWeight: 800,
                                                        fontSize: isMobile
                                                            ? 18
                                                            : 20,
                                                        color: primary,
                                                    }}
                                                >
                                                    {startDate.toLocaleDateString(
                                                        locale,
                                                        {
                                                            weekday: "short",
                                                            day: "numeric",
                                                            month: "short",
                                                            year: "numeric",
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontSize: 24,
                                                    opacity: 0.3,
                                                    transform: isMobile
                                                        ? "rotate(90deg)"
                                                        : "none",
                                                }}
                                            >
                                                →
                                            </div>
                                            <div>
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        opacity: 0.6,
                                                        marginBottom: 6,
                                                        textTransform:
                                                            "uppercase",
                                                        letterSpacing: "0.3px",
                                                    }}
                                                >
                                                    {texts.checkOut}
                                                </div>
                                                <div
                                                    style={{
                                                        fontWeight: 800,
                                                        fontSize: isMobile
                                                            ? 18
                                                            : 20,
                                                        color: primary,
                                                    }}
                                                >
                                                    {endBoundary.toLocaleDateString(
                                                        locale,
                                                        {
                                                            weekday: "short",
                                                            day: "numeric",
                                                            month: "short",
                                                            year: "numeric",
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div
                                    style={{
                                        fontWeight: 800,
                                        fontSize: isMobile ? 20 : 22,
                                        marginBottom: 4,
                                    }}
                                >
                                    {formTexts.title}
                                </div>
                                {formTexts.subtitle && (
                                    <div
                                        style={{
                                            opacity: 0.8,
                                            marginBottom: 6,
                                        }}
                                    >
                                        {formTexts.subtitle}
                                    </div>
                                )}

                                {/* Guest fields with proper labels */}
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: isMobile
                                            ? "1fr"
                                            : "1fr 1fr",
                                        gap: 16,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 6,
                                        }}
                                    >
                                        <label
                                            htmlFor="firstName"
                                            style={{
                                                fontSize: 14,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {formTexts.firstNameLabel}
                                            {formTexts.firstNameRequired && (
                                                <span
                                                    style={{ color: "#dc2626" }}
                                                >
                                                    {" "}
                                                    *
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            id="firstName"
                                            name="firstName"
                                            type="text"
                                            required={
                                                formTexts.firstNameRequired
                                            }
                                            aria-required={
                                                formTexts.firstNameRequired
                                            }
                                            value={client.firstName}
                                            onChange={(e) =>
                                                setClient({
                                                    ...client,
                                                    firstName: e.target.value,
                                                })
                                            }
                                            style={{
                                                border: "1px solid #e5e5e5",
                                                borderRadius: 10,
                                                padding: 12,
                                                fontSize: 16, // Prevent iOS zoom
                                                minHeight: 44,
                                            }}
                                        />
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 6,
                                        }}
                                    >
                                        <label
                                            htmlFor="lastName"
                                            style={{
                                                fontSize: 14,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {formTexts.lastNameLabel}
                                            {formTexts.lastNameRequired && (
                                                <span
                                                    style={{ color: "#dc2626" }}
                                                >
                                                    {" "}
                                                    *
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            id="lastName"
                                            name="lastName"
                                            type="text"
                                            required={
                                                formTexts.lastNameRequired
                                            }
                                            aria-required={
                                                formTexts.lastNameRequired
                                            }
                                            value={client.lastName}
                                            onChange={(e) =>
                                                setClient({
                                                    ...client,
                                                    lastName: e.target.value,
                                                })
                                            }
                                            style={{
                                                border: "1px solid #e5e5e5",
                                                borderRadius: 10,
                                                padding: 12,
                                                fontSize: 16,
                                                minHeight: 44,
                                            }}
                                        />
                                    </div>
                                </div>

                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                    }}
                                >
                                    <label
                                        htmlFor="email"
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 600,
                                        }}
                                    >
                                        {formTexts.emailLabel}
                                        {formTexts.emailRequired && (
                                            <span style={{ color: "#dc2626" }}>
                                                {" "}
                                                *
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        required={formTexts.emailRequired}
                                        aria-required={formTexts.emailRequired}
                                        value={client.email}
                                        onChange={(e) =>
                                            setClient({
                                                ...client,
                                                email: e.target.value,
                                            })
                                        }
                                        style={{
                                            border: "1px solid #e5e5e5",
                                            borderRadius: 10,
                                            padding: 12,
                                            fontSize: 16,
                                            minHeight: 44,
                                        }}
                                    />
                                </div>

                                {/* Custom fields */}
                                {Array.isArray(props.customForm?.fields) &&
                                    props.customForm!.fields!.length > 0 && (
                                        <div
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: isMobile
                                                    ? "1fr"
                                                    : "1fr 1fr",
                                                gap: 16,
                                            }}
                                        >
                                            {props.customForm!.fields!.map(
                                                (f, idx) => {
                                                    const full =
                                                        (f.inputWidth ||
                                                            "auto / span 2") ===
                                                        "auto / span 2"
                                                    const commonStyle: React.CSSProperties =
                                                        {
                                                            border: "1px solid #e5e5e5",
                                                            borderRadius: 10,
                                                            padding: 12,
                                                            fontSize: 16,
                                                            gridColumn:
                                                                full &&
                                                                !isMobile
                                                                    ? "1 / span 2"
                                                                    : "auto / span 1",
                                                            minHeight: 44,
                                                        }
                                                    const options = (
                                                        f.options || ""
                                                    )
                                                        .split(",")
                                                        .map((s) => s.trim())
                                                        .filter(Boolean)
                                                    const key =
                                                        f.labelText ||
                                                        `field_${idx}`
                                                    const setVal = (v: any) =>
                                                        setCustomData((p) => ({
                                                            ...p,
                                                            [key]: v,
                                                        }))
                                                    const val =
                                                        customData[key] ?? ""

                                                    const wrapperStyle = {
                                                        display: "flex",
                                                        flexDirection:
                                                            "column" as const,
                                                        gap: 6,
                                                        gridColumn:
                                                            full && !isMobile
                                                                ? "1 / span 2"
                                                                : "auto / span 1",
                                                    }

                                                    switch (f.type) {
                                                        case "textarea":
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    style={
                                                                        wrapperStyle
                                                                    }
                                                                >
                                                                    <label
                                                                        style={{
                                                                            fontSize: 14,
                                                                            fontWeight: 600,
                                                                        }}
                                                                    >
                                                                        {
                                                                            f.labelText
                                                                        }
                                                                        {f.required && (
                                                                            <span
                                                                                style={{
                                                                                    color: "#dc2626",
                                                                                }}
                                                                            >
                                                                                {" "}
                                                                                *
                                                                            </span>
                                                                        )}
                                                                    </label>
                                                                    <textarea
                                                                        placeholder={
                                                                            f.placeholderText
                                                                        }
                                                                        value={
                                                                            val
                                                                        }
                                                                        required={
                                                                            f.required
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setVal(
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        style={{
                                                                            ...commonStyle,
                                                                            minHeight: 100,
                                                                            resize: "vertical",
                                                                            gridColumn:
                                                                                "unset",
                                                                        }}
                                                                    />
                                                                </div>
                                                            )
                                                        case "select":
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    style={
                                                                        wrapperStyle
                                                                    }
                                                                >
                                                                    <label
                                                                        style={{
                                                                            fontSize: 14,
                                                                            fontWeight: 600,
                                                                        }}
                                                                    >
                                                                        {
                                                                            f.labelText
                                                                        }
                                                                        {f.required && (
                                                                            <span
                                                                                style={{
                                                                                    color: "#dc2626",
                                                                                }}
                                                                            >
                                                                                {" "}
                                                                                *
                                                                            </span>
                                                                        )}
                                                                    </label>
                                                                    <select
                                                                        value={
                                                                            val
                                                                        }
                                                                        required={
                                                                            f.required
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setVal(
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        style={{
                                                                            ...commonStyle,
                                                                            gridColumn:
                                                                                "unset",
                                                                        }}
                                                                    >
                                                                        <option value="">
                                                                            {f.placeholderText ||
                                                                                f.labelText}
                                                                        </option>
                                                                        {options.map(
                                                                            (
                                                                                o
                                                                            ) => (
                                                                                <option
                                                                                    key={
                                                                                        o
                                                                                    }
                                                                                    value={
                                                                                        o
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        o
                                                                                    }
                                                                                </option>
                                                                            )
                                                                        )}
                                                                    </select>
                                                                </div>
                                                            )
                                                        case "multiselect":
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    style={
                                                                        wrapperStyle
                                                                    }
                                                                >
                                                                    <label
                                                                        style={{
                                                                            fontSize: 14,
                                                                            fontWeight: 600,
                                                                        }}
                                                                    >
                                                                        {
                                                                            f.labelText
                                                                        }
                                                                        {f.required && (
                                                                            <span
                                                                                style={{
                                                                                    color: "#dc2626",
                                                                                }}
                                                                            >
                                                                                {" "}
                                                                                *
                                                                            </span>
                                                                        )}
                                                                    </label>
                                                                    <div
                                                                        style={{
                                                                            ...commonStyle,
                                                                            display:
                                                                                "flex",
                                                                            flexDirection:
                                                                                "column",
                                                                            gap: 8,
                                                                            gridColumn:
                                                                                "unset",
                                                                        }}
                                                                    >
                                                                        {options.map(
                                                                            (
                                                                                o
                                                                            ) => {
                                                                                const arr: string[] =
                                                                                    Array.isArray(
                                                                                        val
                                                                                    )
                                                                                        ? val
                                                                                        : []
                                                                                const checked =
                                                                                    arr.includes(
                                                                                        o
                                                                                    )
                                                                                return (
                                                                                    <label
                                                                                        key={
                                                                                            o
                                                                                        }
                                                                                        style={{
                                                                                            display:
                                                                                                "flex",
                                                                                            gap: 8,
                                                                                            alignItems:
                                                                                                "center",
                                                                                        }}
                                                                                    >
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={
                                                                                                checked
                                                                                            }
                                                                                            onChange={(
                                                                                                e
                                                                                            ) => {
                                                                                                const next =
                                                                                                    e
                                                                                                        .target
                                                                                                        .checked
                                                                                                        ? [
                                                                                                            ...arr,
                                                                                                            o,
                                                                                                        ]
                                                                                                        : arr.filter(
                                                                                                            (
                                                                                                                x
                                                                                                            ) =>
                                                                                                                x !==
                                                                                                                o
                                                                                                        )
                                                                                                setVal(
                                                                                                    next
                                                                                                )
                                                                                            }}
                                                                                            style={{
                                                                                                width: 18,
                                                                                                height: 18,
                                                                                            }}
                                                                                        />
                                                                                        {
                                                                                            o
                                                                                        }
                                                                                    </label>
                                                                                )
                                                                            }
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )
                                                        case "number":
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    style={
                                                                        wrapperStyle
                                                                    }
                                                                >
                                                                    <label
                                                                        style={{
                                                                            fontSize: 14,
                                                                            fontWeight: 600,
                                                                        }}
                                                                    >
                                                                        {
                                                                            f.labelText
                                                                        }
                                                                        {f.required && (
                                                                            <span
                                                                                style={{
                                                                                    color: "#dc2626",
                                                                                }}
                                                                            >
                                                                                {" "}
                                                                                *
                                                                            </span>
                                                                        )}
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        placeholder={
                                                                            f.placeholderText
                                                                        }
                                                                        value={
                                                                            val
                                                                        }
                                                                        required={
                                                                            f.required
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setVal(
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        style={{
                                                                            ...commonStyle,
                                                                            gridColumn:
                                                                                "unset",
                                                                        }}
                                                                    />
                                                                </div>
                                                            )
                                                        case "phone":
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    style={
                                                                        wrapperStyle
                                                                    }
                                                                >
                                                                    <label
                                                                        style={{
                                                                            fontSize: 14,
                                                                            fontWeight: 600,
                                                                        }}
                                                                    >
                                                                        {
                                                                            f.labelText
                                                                        }
                                                                        {f.required && (
                                                                            <span
                                                                                style={{
                                                                                    color: "#dc2626",
                                                                                }}
                                                                            >
                                                                                {" "}
                                                                                *
                                                                            </span>
                                                                        )}
                                                                    </label>
                                                                    <input
                                                                        type="tel"
                                                                        placeholder={
                                                                            f.placeholderText
                                                                        }
                                                                        value={
                                                                            val
                                                                        }
                                                                        required={
                                                                            f.required
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setVal(
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        style={{
                                                                            ...commonStyle,
                                                                            gridColumn:
                                                                                "unset",
                                                                        }}
                                                                    />
                                                                </div>
                                                            )
                                                        case "url":
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    style={
                                                                        wrapperStyle
                                                                    }
                                                                >
                                                                    <label
                                                                        style={{
                                                                            fontSize: 14,
                                                                            fontWeight: 600,
                                                                        }}
                                                                    >
                                                                        {
                                                                            f.labelText
                                                                        }
                                                                        {f.required && (
                                                                            <span
                                                                                style={{
                                                                                    color: "#dc2626",
                                                                                }}
                                                                            >
                                                                                {" "}
                                                                                *
                                                                            </span>
                                                                        )}
                                                                    </label>
                                                                    <input
                                                                        type="url"
                                                                        placeholder={
                                                                            f.placeholderText
                                                                        }
                                                                        value={
                                                                            val
                                                                        }
                                                                        required={
                                                                            f.required
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setVal(
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        style={{
                                                                            ...commonStyle,
                                                                            gridColumn:
                                                                                "unset",
                                                                        }}
                                                                    />
                                                                </div>
                                                            )
                                                        default:
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    style={
                                                                        wrapperStyle
                                                                    }
                                                                >
                                                                    <label
                                                                        style={{
                                                                            fontSize: 14,
                                                                            fontWeight: 600,
                                                                        }}
                                                                    >
                                                                        {
                                                                            f.labelText
                                                                        }
                                                                        {f.required && (
                                                                            <span
                                                                                style={{
                                                                                    color: "#dc2626",
                                                                                }}
                                                                            >
                                                                                {" "}
                                                                                *
                                                                            </span>
                                                                        )}
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        placeholder={
                                                                            f.placeholderText
                                                                        }
                                                                        value={
                                                                            val
                                                                        }
                                                                        required={
                                                                            f.required
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setVal(
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        style={{
                                                                            ...commonStyle,
                                                                            gridColumn:
                                                                                "unset",
                                                                        }}
                                                                    />
                                                                </div>
                                                            )
                                                    }
                                                }
                                            )}
                                        </div>
                                    )}

                                {showTerms && (
                                    <AcceptTerms
                                        size={size}
                                        backgroundColor="transparent"
                                        borderRadius={design.buttonRadius}
                                        itemBgColor="transparent"
                                        padding="0"
                                        itemSelectColor={primary}
                                        itemTextColor={primary}
                                        itemSecondaryTextColor={addAlpha(
                                            primary,
                                            0.7
                                        )}
                                        fontFamily={font}
                                        text={termsConfig.text}
                                        highlightedText={
                                            termsConfig.highlightedText
                                        }
                                        termsLink={termsConfig.termsLink}
                                        accepted={termsAccepted}
                                        onAcceptChange={setTermsAccepted}
                                    />
                                )}

                                <button
                                    type="button"
                                    onClick={onBook}
                                    disabled={showTerms && !termsAccepted}
                                    style={{
                                        marginTop: 6,
                                        width: "100%",
                                        background: btn,
                                        color: btnText,
                                        padding: `${design.buttonPaddingV}px 0`,
                                        borderRadius: design.buttonRadius,
                                        border: "none",
                                        cursor:
                                            showTerms && !termsAccepted
                                                ? "not-allowed"
                                                : "pointer",
                                        fontWeight: 800,
                                        fontSize: 16,
                                        minHeight: 48,
                                        opacity:
                                            showTerms && !termsAccepted
                                                ? 0.5
                                                : 1,
                                    }}
                                >
                                    {price
                                        ? `${formTexts.bookNowLabel} – ${formatPrice(price.amount, price.currency, locale)}`
                                        : formTexts.bookNowLabel}
                                </button>

                                {error && (
                                    <div
                                        role="alert"
                                        style={{
                                            color: "#dc2626",
                                            background: "#fee2e2",
                                            padding: 12,
                                            borderRadius: 8,
                                            border: "1px solid #fecaca",
                                            display: "flex",
                                            gap: 8,
                                            alignItems: "flex-start",
                                        }}
                                    >
                                        <AlertCircle
                                            size={18}
                                            style={{
                                                flexShrink: 0,
                                            }}
                                        />
                                        <span style={{ marginTop: 2 }}>
                                            {error}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {step === "success" && (
                    <div
                        style={{
                            padding: isMobile ? 16 : 20,
                            textAlign: "center",
                        }}
                    >
                        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                        <div
                            style={{
                                fontWeight: 700,
                                marginBottom: 12,
                                fontSize: 20,
                            }}
                        >
                            {texts.bookingRequestedTitle}
                        </div>
                        <div style={{ opacity: 0.85, lineHeight: 1.5 }}>
                            {texts.bookingRequestedMessage}
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}

export function adjustToSize(size: number, toSize: "sm" | "md" | "lg"): string {
    const newSize = adjustToSizeNum(size, toSize)
    return `${newSize}px`
}

export function adjustToSizeNum(
    size: number,
    toSize: "sm" | "md" | "lg"
): number {
    switch (toSize) {
        case "sm":
            return Math.round((size / 4) * 0.75 * 4)
        case "md":
            return size
        case "lg":
            return Math.round((size / 4) * 1.25 * 4)
        default:
            return size
    }
}

interface AcceptTermsProps {
    size: "sm" | "md" | "lg"
    backgroundColor: string
    borderRadius: number
    itemBgColor: string
    padding: string
    itemSelectColor: string
    itemTextColor: string
    itemSecondaryTextColor: string
    fontFamily: string
    text: string
    highlightedText: string
    termsLink: string
    accepted: boolean
    onAcceptChange: (accepted: boolean) => void
}

const AcceptTerms: React.FC<AcceptTermsProps> = ({
                                                     size,
                                                     borderRadius,
                                                     backgroundColor,
                                                     itemBgColor,
                                                     itemSelectColor,
                                                     padding,
                                                     itemTextColor,
                                                     itemSecondaryTextColor,
                                                     fontFamily,
                                                     text,
                                                     highlightedText,
                                                     termsLink,
                                                     accepted,
                                                     onAcceptChange,
                                                 }) => {
        const containerStyle = {
            width: "100%",
            padding: padding,
            backgroundColor: backgroundColor,
            display: "flex",
            alignItems: "flex-start",
            gap: adjustToSize(12, size),
            borderRadius: borderRadius,
        }

        const checkboxStyle = {
            width: adjustToSize(24, size),
            height: adjustToSize(24, size),
            borderRadius: "50%",
            border: `2px solid ${itemSecondaryTextColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            backgroundColor: accepted ? itemSelectColor : "transparent",
            borderColor: accepted ? itemSelectColor : itemSecondaryTextColor,
            flexShrink: 0,
            transition: "all 0.2s ease",
        }

        const textStyle = {
            fontWeight: 500,
            fontSize: adjustToSize(17, size),
            color: itemSecondaryTextColor,
            fontFamily: fontFamily || "inherit",
            margin: 0,
        }

        const linkStyle = {
            fontWeight: 500,
            color: itemSelectColor,
            textDecoration: "underline",
            cursor: "pointer",
            "&:hover": {
                textDecoration: "underline",
            },
        }

        return (
            <div style={containerStyle}>
                <div
                    style={checkboxStyle}
                    onClick={() => onAcceptChange(!accepted)}
                    role="checkbox"
                    aria-checked={accepted}
                    tabIndex={0}
                    onKeyPress={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            onAcceptChange(!accepted)
                        }
                    }}
                >
                    {accepted && (
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M13.3333 4L6 11.3333L2.66667 8"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    )}
                </div>
                <p style={textStyle}>
                    {text}{" "}
                    <a
                        href={termsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={linkStyle}
                    >
                        {highlightedText}
                    </a>
                </p>
            </div>
        )
    }

    /* ============================== Framer controls ============================== */
;(VillaBookingComponent as any).propertyControls = {
    // Visuals
    size: {
        type: ControlType.Enum,
        title: "Size",
        options: ["sm", "md", "lg"],
        defaultValue: "md",
    },
    primaryColor: {
        type: ControlType.Color,
        title: "Primary",
        defaultValue: "#111111",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#FFFFFF",
    },
    buttonBg: {
        type: ControlType.Color,
        title: "Button BG",
        defaultValue: "#000000",
    },
    buttonText: {
        type: ControlType.Color,
        title: "Button Text",
        defaultValue: "#FFFFFF",
    },
    fontFamily: {
        type: ControlType.String,
        title: "Font",
        defaultValue: "Inter",
    },

    // Locale
    locale: {
        type: ControlType.String,
        title: "Locale",
        defaultValue: "en",
        description:
            "Locale for date, time, number, and currency formatting (e.g., 'en', 'es', 'fr', 'de', 'en-US', 'es-ES')",
    },

    // Layout
    visibleMonths: {
        type: ControlType.Number,
        title: "Visible Months",
        defaultValue: 3,
        min: 1,
        max: 12,
        step: 1,
    },
    weeksPerRow: {
        type: ControlType.Number,
        title: "Weeks / Row",
        defaultValue: 3,
        min: 1,
        max: 6,
        step: 1,
    },

    // Mode
    lengthMode: {
        type: ControlType.Enum,
        title: "Duration Mode",
        options: ["weeks", "days"],
        optionTitles: ["Weeks (7n, same weekday end)", "Days (multiples)"],
        defaultValue: "weeks",
    },

    // Weeks start rule (weekday only)
    weeksStartRule: {
        type: ControlType.Enum,
        title: "Weeks start rule",
        options: [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        ],
        optionTitles: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ],
        defaultValue: "sunday",
        hidden: (p: any) => p.lengthMode !== "weeks",
    },

    // Days mode (keeps "Any")
    daysStartRule: {
        type: ControlType.Enum,
        title: "Start Day (days)",
        options: [
            "any",
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        ],
        optionTitles: [
            "Any",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ],
        defaultValue: "any",
        hidden: (p: any) => p.lengthMode !== "days",
    },
    daysBaseLength: {
        type: ControlType.Number,
        title: "Base Length (days)",
        defaultValue: 7,
        min: 1,
        max: 31,
        step: 1,
        hidden: (p: any) => p.lengthMode !== "days",
    },
    daysMaxTotal: {
        type: ControlType.Number,
        title: "Max Total (days)",
        defaultValue: 28,
        min: 1,
        max: 365,
        step: 1,
        hidden: (p: any) => p.lengthMode !== "days",
    },
    fixedLengthDays: {
        type: ControlType.Number,
        title: "Fixed Length (days)",
        defaultValue: 0,
        min: 0,
        max: 365,
        step: 1,
        description:
            "0 = disabled. When >0, enforces this exact length (Days mode only).",
        hidden: (p: any) => p.lengthMode !== "days",
    },

    // Bookla
    bkla: {
        type: ControlType.Object,
        title: "Bookla",
        controls: {
            apiRegion: {
                type: ControlType.Enum,
                title: "Region",
                options: ["us", "eu"],
                defaultValue: "eu",
            },
            apiKey: {
                type: ControlType.String,
                title: "API Key",
                defaultValue: "",
            },
            companyID: {
                type: ControlType.String,
                title: "Company ID",
                defaultValue: "",
            },
        },
    },
    serviceID: {
        type: ControlType.String,
        title: "Service ID",
        defaultValue: "",
    },
    resourceID: {
        type: ControlType.String,
        title: "Resource ID",
        defaultValue: "",
    },

    // Card hint
    weeksHintText: {
        type: ControlType.String,
        title: "Weeks hint text",
        defaultValue: "1 week (7 nights)",
        description: "Hint text shown for week selections.",
        hidden: (p: any) => p.lengthMode !== "weeks",
    },
    daysHintText: {
        type: ControlType.String,
        title: "Days hint text",
        defaultValue: "Click to select {days}-day period",
        description:
            "Hint text shown for day selections. {days} will be replaced with the actual number.",
        hidden: (p: any) => p.lengthMode !== "days",
    },

    // Design
    design: {
        type: ControlType.Object,
        title: "Design",
        controls: {
            gridGap: {
                type: ControlType.Number,
                title: "Grid gap",
                defaultValue: 12,
                min: 0,
                max: 40,
                step: 1,
            },
            cardRadius: {
                type: ControlType.Number,
                title: "Card radius",
                defaultValue: 12,
                min: 0,
                max: 40,
                step: 1,
            },
            cardPadding: {
                type: ControlType.Number,
                title: "Card padding",
                defaultValue: 14,
                min: 6,
                max: 28,
                step: 1,
            },
            cardBorderColor: {
                type: ControlType.Color,
                title: "Card border",
                defaultValue: "#e5e5e5",
            },
            cardBorderWidth: {
                type: ControlType.Number,
                title: "Border width",
                defaultValue: 1,
                min: 0,
                max: 4,
                step: 1,
            },
            cardShadow: {
                type: ControlType.Boolean,
                title: "Card shadow",
                defaultValue: true,
            },
            stripeEnabled: {
                type: ControlType.Boolean,
                title: "Stripes on unavailable",
                defaultValue: true,
            },
            stripeColorA: {
                type: ControlType.Color,
                title: "Stripe color A",
                defaultValue: "rgba(0,0,0,0.06)",
            },
            stripeColorB: {
                type: ControlType.Color,
                title: "Stripe color B",
                defaultValue: "rgba(255,255,255,0.06)",
            },
            stripeAngle: {
                type: ControlType.Number,
                title: "Stripe angle",
                defaultValue: 135,
                min: 0,
                max: 360,
                step: 1,
            },
            stripeSize: {
                type: ControlType.Number,
                title: "Stripe size",
                defaultValue: 8,
                min: 2,
                max: 24,
                step: 1,
            },
            stripeOpacity: {
                type: ControlType.Number,
                title: "Stripe opacity",
                defaultValue: 0.9,
                min: 0.1,
                max: 1,
                step: 0.05,
            },
            pillRadius: {
                type: ControlType.Number,
                title: "Pill radius",
                defaultValue: 999,
                min: 0,
                max: 40,
                step: 1,
            },
            buttonRadius: {
                type: ControlType.Number,
                title: "Main button radius",
                defaultValue: 12,
                min: 0,
                max: 40,
                step: 1,
            },
            buttonPaddingV: {
                type: ControlType.Number,
                title: "Main button padding V",
                defaultValue: 14,
                min: 8,
                max: 24,
                step: 1,
            },
        },
    },

    // Form texts
    formTexts: {
        type: ControlType.Object,
        title: "Form texts",
        controls: {
            title: {
                type: ControlType.String,
                title: "Title",
                defaultValue: "Guest details",
            },
            subtitle: {
                type: ControlType.String,
                title: "Subtitle",
                defaultValue: "Please fill in your details",
            },
            firstName: {
                type: ControlType.String,
                title: "First name",
                defaultValue: "First name",
            },
            lastName: {
                type: ControlType.String,
                title: "Last name",
                defaultValue: "Last name",
            },
            email: {
                type: ControlType.String,
                title: "Email",
                defaultValue: "Email",
            },
        },
    },

    // Custom form
    customForm: {
        type: ControlType.Object,
        title: "Custom Form",
        controls: {
            formTitle: {
                type: ControlType.String,
                title: "Title",
                defaultValue: "Additional information",
            },
            formSubtitle: {
                type: ControlType.String,
                title: "Subtitle",
                defaultValue: "Please fill out extra fields if needed",
            },
            fields: {
                type: ControlType.Array,
                title: "Fields",
                control: {
                    type: ControlType.Object,
                    controls: {
                        labelText: {
                            type: ControlType.String,
                            title: "Label",
                            defaultValue: "",
                        },
                        type: {
                            type: ControlType.Enum,
                            title: "Type",
                            options: [
                                "text",
                                "textarea",
                                "number",
                                "select",
                                "multiselect",
                                "phone",
                                "url",
                            ],
                            defaultValue: "text",
                            optionTitles: [
                                "Text",
                                "Textarea",
                                "Number",
                                "Select",
                                "Multi Select",
                                "Phone",
                                "URL",
                            ],
                        },
                        placeholderText: {
                            type: ControlType.String,
                            title: "Placeholder",
                            defaultValue: "",
                        },
                    },
                },
            },
        },
    },

    showTerms: {
        type: ControlType.Boolean,
        title: "Show Terms",
        defaultValue: false,
    },
    terms: {
        type: ControlType.Object,
        title: "Terms",
        hidden(props) {
            return !props.showTerms
        },
        controls: {
            text: {
                type: ControlType.String,
                title: "Text",
                defaultValue: "I accept the",
            },
            highlightedText: {
                type: ControlType.String,
                title: "Link Text",
                defaultValue: "terms and conditions",
            },
            termsLink: {
                type: ControlType.String,
                title: "Terms Link",
                defaultValue: "https://example.com/terms",
            },
        },
    },

    // Routes
    routes: {
        type: ControlType.Object,
        title: "Routes",
        controls: {
            confirmed: {
                type: ControlType.Link,
                title: "Confirmed",
                defaultValue: "/",
            },
            pending: {
                type: ControlType.Link,
                title: "Pending",
                defaultValue: "/",
            },
        },
    },

    // Modal
    modalMode: {
        type: ControlType.Enum,
        title: "Modal Mode",
        options: ["contained", "fullscreen"],
        optionTitles: ["Contained (within component)", "Fullscreen"],
        defaultValue: "contained",
    },

    // UI Texts (for localization)
    texts: {
        type: ControlType.Object,
        title: "UI Texts",
        controls: {
            // Navigation
            previousMonth: {
                type: ControlType.String,
                title: "Previous Month",
                defaultValue: "Previous month",
            },
            nextMonth: {
                type: ControlType.String,
                title: "Next Month",
                defaultValue: "Next month",
            },
            close: {
                type: ControlType.String,
                title: "Close",
                defaultValue: "Close",
            },
            daysStartDayAnyInstruction: {
                type: ControlType.String,
                title: "Days Any Instruction",
                defaultValue: "Start day can be any. Choose length below.",
            },
            daysStartDayFixedInstruction: {
                type: ControlType.String,
                title: "Days Fixed Instruction",
                defaultValue:
                    "Start day must be {weekday}. Choose length below.",
                description:
                    "{weekday} will be replaced with the actual weekday name.",
            },
            // Selection display
            checkIn: {
                type: ControlType.String,
                title: "Check-in Label",
                defaultValue: "Check-in",
            },
            checkOut: {
                type: ControlType.String,
                title: "Check-out Label",
                defaultValue: "Check-out",
            },
            day: {
                type: ControlType.String,
                title: "Day (singular)",
                defaultValue: "day",
            },
            days: {
                type: ControlType.String,
                title: "Days (plural)",
                defaultValue: "days",
            },
            // Price
            fetchingPrice: {
                type: ControlType.String,
                title: "Fetching Price",
                defaultValue: "Fetching price…",
            },
            priceLabel: {
                type: ControlType.String,
                title: "Price Label",
                defaultValue: "Price for selected period:",
            },
            // Success
            bookingRequestedTitle: {
                type: ControlType.String,
                title: "Success Title",
                defaultValue: "Booking requested",
            },
            bookingRequestedMessage: {
                type: ControlType.String,
                title: "Success Message",
                defaultValue:
                    "We've received your request. You'll get a confirmation or payment step next.",
            },
            // Errors
            missingConfig: {
                type: ControlType.String,
                title: "Missing Config Error",
                defaultValue:
                    "Missing Bookla config (API key / company / service / resource).",
            },
            availabilityError: {
                type: ControlType.String,
                title: "Availability Error",
                defaultValue: "Failed to load availability.",
            },
            firstNameRequired: {
                type: ControlType.String,
                title: "First Name Required",
                defaultValue: "Please enter your first name.",
            },
            lastNameRequired: {
                type: ControlType.String,
                title: "Last Name Required",
                defaultValue: "Please enter your last name.",
            },
            emailRequired: {
                type: ControlType.String,
                title: "Email Required",
                defaultValue: "Please enter your email.",
            },
            noSlotFound: {
                type: ControlType.String,
                title: "No Slot Found",
                defaultValue: "No available slot found for the selected dates.",
            },
            bookingFailed: {
                type: ControlType.String,
                title: "Booking Failed",
                defaultValue:
                    "Booking failed. Please try a different date or contact support.",
            },
        },
    },
}
