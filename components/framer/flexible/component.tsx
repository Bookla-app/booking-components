import React, {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback,
    useImperativeHandle,
    forwardRef,
} from "react"
import { ControlType } from "framer"
import { Calendar, Minus, Plus } from "lucide-react"
import { BooklaSDK } from "https://esm.sh/@bookla-app/react-client-sdk@0.6.2"
import { v4 as uuid } from "uuid"

// @ts-ignore
import { useRouter } from "framer"

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface TimeSlot {
    startTime: string
    endTime: string
    price?: {
        amount: number
        currency: string
    }
}

interface TimeSlotWithResource {
    timeSlot: TimeSlot
    resourceID: string
}

interface ClientData {
    id?: string
    email: string
    firstName: string
    lastName: string
}

interface Duration {
    days: number
    hours: number
    minutes: number
}

interface CustomFormField {
    placeholderText: string
    type:
        | "text"
        | "number"
        | "multiselect"
        | "select"
        | "phone"
        | "url"
        | "textarea"
    inputWidth: "auto / span 1" | "auto / span 2"
    required: boolean
    labelText: string
    errorText: string
    options?: string
}

interface FormValidation {
    isValid: boolean
    errors: { [key: string]: string }
}

enum BookingStep {
    Date,
    CustomForm,
    Guest,
    Form,
    Success,
    Pending,
    Error,
}

// ============================================================================
// UTILITY FUNCTIONS AND STYLES
// ============================================================================

const adjustToSize = (baseSize: number, size: string): string => {
    const sizeMultiplier = {
        sm: 0.8,
        md: 1,
        lg: 1.2,
    }
    return `${baseSize * sizeMultiplier[size]}px`
}

const adjustToSizeNum = (baseSize: number, size: string): number => {
    const sizeMultiplier = {
        sm: 0.8,
        md: 1,
        lg: 1.2,
    }
    return baseSize * sizeMultiplier[size]
}

const formatPrice = (amount: number, currency: string): string => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
    }).format(amount / 100)
}

const getTimezoneOffset = (timeZone: string, date: Date): number => {
    const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }))
    const localDate = new Date(date.toLocaleString("en-US", { timeZone }))
    return (utcDate.getTime() - localDate.getTime()) / (1000 * 60)
}

function getRouteId(allRoute, path) {
    for (const [key, value] of Object.entries(allRoute)) {
        if (value?.path === path) {
            return key
        }
    }
    return ""
}

const durationToISO = (duration: Duration): string => {
    return `PT${duration.hours}H${duration.minutes}M`
}

// Styles
const headline2 = {
    fontWeight: "600",
    lineHeight: "1.2",
}

const body1 = {
    fontWeight: "400",
    lineHeight: "1.4",
}

const body2 = {
    fontWeight: "400",
    lineHeight: "1.3",
}

const spinnerStyle = (color: string) => ({
    position: "absolute" as const,
    right: "16px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "20px",
    height: "20px",
    border: `2px solid transparent`,
    borderTop: `2px solid ${color}`,
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
})

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// DatePicker Component
interface DatePickerProps {
    size: "sm" | "md" | "lg"
    backgroundColor: string
    border: { borderWidth: number; borderColor: string; borderStyle: string }
    borderRadius: number
    primary: string
    padding: string
    itemBgColor: string
    itemSelectColor: string
    itemTextColor: string
    itemSecondaryTextColor: string
    itemSelectedTextColor: string
    itemSelectedSecondaryTextColor: string
    itemBorderRadius: string
    fontFamily: string
    locale: string
    value?: Date
    onDateChange?: (date: Date) => void
    startOnMonday?: boolean
    minDates?: number
    maxDates?: number
    availableDates?: string[]
}

interface DatePickerRef {
    doChangeDate: (date: Date) => void
}

const DatePicker = forwardRef<DatePickerRef, DatePickerProps>(
    (
        {
            size,
            backgroundColor,
            border,
            borderRadius,
            padding,
            primary,
            itemBgColor,
            itemSelectColor,
            itemTextColor,
            itemSecondaryTextColor,
            itemSelectedTextColor,
            itemSelectedSecondaryTextColor,
            itemBorderRadius,
            fontFamily,
            locale,
            value,
            onDateChange,
            startOnMonday = true,
            minDates = 3,
            maxDates = 7,
            availableDates = [],
        },
        ref
    ) => {
        const [selectedDate, setSelectedDate] = useState(value || new Date())
        const [visibleDates, setVisibleDates] = useState<Date[]>([])
        const [startOffset, setStartOffset] = useState(0)
        const [visibleCount, setVisibleCount] = useState(maxDates)
        const containerRef = useRef(null)

        const doChangeDate = useCallback(
            (newDate: Date) => {
                setSelectedDate(newDate)
                onDateChange?.(newDate)

                // Calculate if the new date would be in the current visible range
                const today = new Date()
                const newDateOffset = Math.floor(
                    (newDate.getTime() - today.getTime()) /
                    (1000 * 60 * 60 * 24)
                )

                // Check if the new date falls within the current visible range
                const rangeStart = startOffset
                const rangeEnd = startOffset + visibleCount - 1

                if (newDateOffset < rangeStart || newDateOffset > rangeEnd) {
                    setStartOffset(newDateOffset)
                }
            },
            [onDateChange, startOffset, visibleCount]
        )

        useImperativeHandle(ref, () => ({
            doChangeDate,
        }))

        const calculateVisibleDates = useCallback(() => {
            if (!containerRef.current) return
            const containerWidth = containerRef.current.offsetWidth
            const minWidth = adjustToSizeNum(80, size)
            const calculatedCount = Math.floor(
                (containerWidth - adjustToSizeNum(36, size)) / minWidth
            )
            const newCount = Math.max(
                minDates,
                Math.min(maxDates, calculatedCount)
            )
            setVisibleCount(newCount)
        }, [minDates, maxDates, size])

        const generateDateRange = useCallback(() => {
            const dates = []
            const baseDate = new Date()
            baseDate.setDate(baseDate.getDate() + startOffset)

            for (let i = 0; i < visibleCount; i++) {
                const date = new Date(baseDate)
                date.setDate(baseDate.getDate() + i)
                dates.push(date)
            }
            return dates
        }, [startOffset, visibleCount])

        useEffect(() => {
            calculateVisibleDates()
            const handleResize = () => calculateVisibleDates()
            window.addEventListener("resize", handleResize)
            return () => window.removeEventListener("resize", handleResize)
        }, [calculateVisibleDates])

        useEffect(() => {
            setVisibleDates(generateDateRange())
        }, [generateDateRange])

        // Fixed: Remove doChangeDate from dependency array to prevent unnecessary repositioning
        useEffect(() => {
            if (value !== undefined) {
                doChangeDate(value)
            }
        }, [value])

        // Separate function for clicking on visible dates - doesn't reposition
        const handleDateClick = (date: Date) => {
            setSelectedDate(date)
            onDateChange?.(date)
        }

        const handlePrevious = () => {
            setStartOffset((prev) => prev - (visibleCount - 1))
        }

        const handleNext = () => {
            setStartOffset((prev) => prev + (visibleCount - 1))
        }

        // This function is only for the native date input - repositions to show selected date
        const handleNativeDateChange = (
            e: React.ChangeEvent<HTMLInputElement>
        ) => {
            const newDate = new Date(e.target.value)
            doChangeDate(newDate)
        }

        const formatHeaderDate = (date: Date) => {
            return new Intl.DateTimeFormat(locale, {
                day: "numeric",
                month: "long",
                year: "numeric",
            }).format(date)
        }

        const isDateAvailable = (date: Date) => {
            if (availableDates.length === 0) return true
            // Use local date formatting to avoid timezone issues
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
            return availableDates.includes(dateStr)
        }

        const containerStyle = {
            width: "100%",
            margin: "0 auto",
            padding: padding,
            backgroundColor: backgroundColor,
            borderWidth: border.borderWidth,
            borderColor: border.borderColor,
            borderStyle: border.borderStyle,
            borderRadius: borderRadius,
        }

        const headerStyle = {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: adjustToSize(8, size),
        }

        const titleStyle = {
            ...headline2,
            color: primary,
            fontFamily: fontFamily !== "" ? fontFamily : null,
            fontSize: adjustToSize(17, size),
        }

        const dateGridStyle = {
            display: "flex",
            gap: adjustToSize(8, size),
            width: "100%",
        }

        const getDateButtonStyle = (
            isSelected: boolean,
            isCurrentDate: boolean,
            isAvailable: boolean
        ) => ({
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            padding: adjustToSize(12, size),
            backgroundColor: isSelected ? itemSelectColor : itemBgColor,
            color: isSelected ? itemSelectedTextColor : itemTextColor,
            boxShadow:
                isCurrentDate && !isSelected
                    ? `inset 0 0 0 2px ${primary}`
                    : "none",
            border: "none",
            borderRadius: itemBorderRadius,
            cursor: isAvailable ? "pointer" : "not-allowed",
            opacity: isAvailable ? 1 : 0.3,
            minWidth: adjustToSize(64, size),
        })

        const navigationButtonStyle = {
            background: "none",
            border: "0px",
            cursor: "pointer",
            borderRadius: itemBorderRadius,
            padding: "8px " + adjustToSize(8, size),
            minWidth: "40px",
        }

        return (
            <div style={containerStyle} ref={containerRef}>
                <div style={headerStyle}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: adjustToSize(8, size),
                        }}
                    >
                        <h2 style={titleStyle}>
                            {formatHeaderDate(selectedDate)}
                        </h2>
                        <div
                            style={{
                                position: "relative",
                                display: "flex",
                                alignItems: "center",
                            }}
                        >
                            <Calendar
                                size={adjustToSizeNum(20, size)}
                                color={itemSecondaryTextColor}
                            />
                            <input
                                type="date"
                                onChange={handleNativeDateChange}
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    top: 0,
                                    width: "100%",
                                    height: "100%",
                                    opacity: 0,
                                    cursor: "pointer",
                                }}
                                value={selectedDate.toISOString().split("T")[0]}
                                aria-label="Choose date"
                            />
                        </div>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: adjustToSize(8, size),
                        }}
                    >
                        <button
                            onClick={handlePrevious}
                            style={navigationButtonStyle}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                            >
                                <path
                                    d="M9.5 12L5.5 8L9.5 4"
                                    stroke={itemTextColor}
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </button>
                        <button
                            onClick={handleNext}
                            style={navigationButtonStyle}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                            >
                                <path
                                    d="M6.5 12L10.5 8L6.5 4"
                                    stroke={itemTextColor}
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </button>
                    </div>
                </div>

                <div style={dateGridStyle}>
                    {visibleDates.map((date, index) => {
                        const isSelected =
                            selectedDate.getDate() === date.getDate() &&
                            selectedDate.getMonth() === date.getMonth() &&
                            selectedDate.getFullYear() === date.getFullYear()

                        const isCurrentDate =
                            date.getDate() === new Date().getDate() &&
                            date.getMonth() === new Date().getMonth() &&
                            date.getFullYear() === new Date().getFullYear()

                        const isAvailable = isDateAvailable(date)

                        return (
                            <button
                                key={date.toISOString()}
                                onClick={() =>
                                    isAvailable && handleDateClick(date)
                                }
                                style={getDateButtonStyle(
                                    isSelected,
                                    isCurrentDate,
                                    isAvailable
                                )}
                                disabled={!isAvailable}
                            >
                                <span
                                    style={{
                                        ...body2,
                                        fontSize: adjustToSize(14, size),
                                        marginBottom: adjustToSize(4, size),
                                        color: isSelected
                                            ? itemSelectedSecondaryTextColor
                                            : itemSecondaryTextColor,
                                    }}
                                >
                                    {new Intl.DateTimeFormat(locale, {
                                        weekday: "short",
                                    }).format(date)}
                                </span>
                                <span
                                    style={{
                                        ...headline2,
                                        fontSize: adjustToSize(17, size),
                                    }}
                                >
                                    {date.getDate()}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>
        )
    }
)

// DurationPicker Component
interface DurationPickerProps {
    title: string
    size: "sm" | "md" | "lg"
    backgroundColor: string
    borderRadius: number
    padding: string
    border: { borderWidth: number; borderColor: string; borderStyle: string }
    itemBgColor: string
    itemSelectColor: string
    itemTextColor: string
    itemSecondaryTextColor: string
    itemBorderRadius: string
    fontFamily: string
    locale: string
    minDuration: Duration
    stepDuration: Duration
    maxDuration: Duration
    onDurationChange?: (duration: Duration) => void
}

const DurationPicker: React.FC<DurationPickerProps> = ({
                                                           title,
                                                           size,
                                                           backgroundColor,
                                                           borderRadius,
                                                           border,
                                                           padding,
                                                           itemBgColor,
                                                           itemSelectColor,
                                                           itemTextColor,
                                                           itemSecondaryTextColor,
                                                           itemBorderRadius,
                                                           fontFamily,
                                                           locale = "en-US",
                                                           minDuration = { days: 0, hours: 0, minutes: 30 },
                                                           stepDuration = { days: 0, hours: 0, minutes: 15 },
                                                           maxDuration = { days: 0, hours: 2, minutes: 0 },
                                                           onDurationChange,
                                                       }) => {
    const [duration, setDuration] = useState<Duration>(minDuration)

    const convertToMinutes = (duration: Duration): number => {
        return duration.hours * 60 + duration.minutes
    }

    const convertToHoursAndMinutes = (totalMinutes: number): Duration => {
        return {
            days: 0,
            hours: Math.floor(totalMinutes / 60),
            minutes: totalMinutes % 60,
        }
    }

    const handleDurationChange = (up: boolean) => {
        const currentMinutes = convertToMinutes(duration)
        const stepMinutes = convertToMinutes(stepDuration)
        const newTotalMinutes = up
            ? currentMinutes + stepMinutes
            : currentMinutes - stepMinutes

        const minMinutes = convertToMinutes(minDuration)
        const maxMinutes = convertToMinutes(maxDuration)

        if (
            newTotalMinutes >= minMinutes &&
            (newTotalMinutes <= maxMinutes || maxMinutes === 0)
        ) {
            const newDuration = convertToHoursAndMinutes(newTotalMinutes)
            setDuration(newDuration)
            onDurationChange?.(newDuration)
        }
    }

    const formatDuration = (duration: Duration): string => {
        if (typeof window !== "undefined" && "Intl" in window) {
            try {
                const formatter = new (Intl as any).DurationFormat(locale, {
                    style: "short",
                })
                return formatter.format({
                    hours: duration.hours,
                    minutes: duration.minutes,
                })
            } catch (e) {
                // Fallback if DurationFormat is not supported
            }
        }
        return `${duration.hours}h ${duration.minutes}m`
    }

    const minusButtonEnabled =
        convertToMinutes(duration) > convertToMinutes(minDuration)
    const plusButtonEnabled =
        convertToMinutes(duration) < convertToMinutes(maxDuration) ||
        convertToMinutes(maxDuration) === 0

    const containerStyle = {
        width: "100%",
        padding: padding,
        backgroundColor: backgroundColor,
        borderRadius: borderRadius,
        borderColor: border.borderColor,
        borderWidth: border.borderWidth,
        borderStyle: border.borderStyle,
    }

    const contentStyle = {
        display: "flex",
        flexDirection: "row" as const,
        alignItems: "center",
        gap: adjustToSize(16, size),
    }

    const titleStyle = {
        ...body2,
        fontFamily: fontFamily !== "" ? fontFamily : null,
        fontSize: adjustToSize(17, size),
        color: itemSecondaryTextColor,
        flex: "1",
    }

    const controlsContainerStyle = {
        display: "flex",
        alignItems: "center",
        gap: adjustToSize(8, size),
        backgroundColor: itemBgColor,
        padding: adjustToSize(4, size),
        borderRadius: itemBorderRadius,
        border: "none",
    }

    const buttonStyle = (enabled: boolean) => ({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: adjustToSize(6, size),
        backgroundColor: "transparent",
        border: "none",
        borderRadius: adjustToSize(4, size),
        cursor: enabled ? "pointer" : "not-allowed",
        opacity: enabled ? 1 : 0.2,
        color: itemTextColor,
        transition: "all 0.2s ease",
    })

    const durationDisplayStyle = {
        padding: `${adjustToSize(4, size)} ${adjustToSize(8, size)}`,
        fontSize: adjustToSize(17, size),
        fontWeight: "500",
        color: itemTextColor,
        minWidth: adjustToSize(60, size),
        textAlign: "center" as const,
    }

    return (
        <div style={containerStyle}>
            <div style={contentStyle}>
                <div style={titleStyle}>{title}</div>
                <div style={controlsContainerStyle}>
                    <button
                        onClick={() => handleDurationChange(false)}
                        style={buttonStyle(minusButtonEnabled)}
                        disabled={!minusButtonEnabled}
                        aria-label="Decrease duration"
                    >
                        <Minus size={16} />
                    </button>
                    <div style={durationDisplayStyle}>
                        {formatDuration(duration)}
                    </div>
                    <button
                        onClick={() => handleDurationChange(true)}
                        style={buttonStyle(plusButtonEnabled)}
                        disabled={!plusButtonEnabled}
                        aria-label="Increase duration"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>
        </div>
    )
}

// TimePicker Component
interface TimePickerProps {
    size: "sm" | "md" | "lg"
    backgroundColor: string
    borderRadius: number
    border: { borderWidth: number; borderColor: string; borderStyle: string }
    padding: string
    itemBgColor: string
    itemSelectColor: string
    itemTextColor: string
    itemSecondaryTextColor: string
    itemSelectedTextColor: string
    itemSelectedSecondaryTextColor: string
    itemBorderRadius: string
    fontFamily: string
    locale: string
    noTimesText: string
    isLoading: boolean
    times: TimeSlotWithResource[]
    timeZone: string
    onTimeChange?: (time: TimeSlotWithResource) => void
    availableDates?: string[]
    selectedDate?: Date
    onDateChange?: (date: Date) => void
}

const TimePicker: React.FC<TimePickerProps> = ({
                                                   size,
                                                   backgroundColor,
                                                   borderRadius,
                                                   border,
                                                   itemBgColor,
                                                   padding,
                                                   itemSelectColor,
                                                   itemTextColor,
                                                   itemSecondaryTextColor,
                                                   itemSelectedTextColor,
                                                   itemSelectedSecondaryTextColor,
                                                   itemBorderRadius,
                                                   fontFamily,
                                                   locale,
                                                   noTimesText,
                                                   isLoading,
                                                   times,
                                                   timeZone,
                                                   onTimeChange,
                                                   availableDates,
                                                   selectedDate,
                                                   onDateChange,
                                               }) => {
    const [selectedTime, setSelectedTime] = useState<TimeSlotWithResource>(null)

    const handleSelectedTime = (time: TimeSlotWithResource) => {
        setSelectedTime(time)
        onTimeChange?.(time)
    }

    const getNextAvailableDate = (): Date | null => {
        if (!availableDates || availableDates.length === 0 || !selectedDate)
            return null

        const currentSelectedDate = new Date(selectedDate)
        currentSelectedDate.setHours(0, 0, 0, 0)

        // Find the next available date after the currently selected date
        const nextAvailableDates = availableDates
            .map((dateStr) => new Date(dateStr))
            .filter((date) => {
                date.setHours(0, 0, 0, 0)
                return date > currentSelectedDate
            })
            .sort((a, b) => a.getTime() - b.getTime())

        if (nextAvailableDates.length > 0 && nextAvailableDates[0]) {
            return nextAvailableDates[0]
        }

        return null
    }

    const handleGoToNextAvailableDate = () => {
        const nextAvailableDate = getNextAvailableDate()
        if (nextAvailableDate && onDateChange) {
            onDateChange(nextAvailableDate)
        }
    }

    const formatDateForDisplay = (date: Date): string => {
        try {
            return new Intl.DateTimeFormat(locale, {
                weekday: "long",
                day: "numeric",
                month: "long",
            }).format(date)
        } catch {
            return date.toLocaleDateString()
        }
    }

    useEffect(() => {
        setSelectedTime(null)
    }, [times])

    const containerStyle = {
        width: "100%",
        margin: "0 auto",
        padding: padding,
        backgroundColor: backgroundColor,
        borderRadius: borderRadius,
        borderColor: border.borderColor,
        borderWidth: border.borderWidth,
        borderStyle: border.borderStyle,
    }

    const loadingContainerStyle = {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "80px",
    }

    const spinnerStyle = {
        width: "40px",
        height: "40px",
        border: "3px solid " + itemTextColor,
        borderTop: "3px solid " + itemSecondaryTextColor,
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
    }

    const dateGridStyle = {
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${adjustToSize(120, size)}, 1fr))`,
        gap: adjustToSize(8, size),
        width: "100%",
    }

    const noTimesStyle = {
        ...body2,
        fontFamily: fontFamily !== "" ? fontFamily : null,
        fontSize: adjustToSize(17, size),
        color: itemSecondaryTextColor,
    }

    const getTimeButtonStyle = (isSelected: boolean) => ({
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        padding: adjustToSize(12, size),
        backgroundColor: isSelected ? itemSelectColor : itemBgColor,
        color: isSelected ? itemSelectedTextColor : itemTextColor,
        border: "none",
        borderRadius: itemBorderRadius,
        cursor: "pointer",
        transition: "all 0.2s ease",
    })

    const goToDateButtonStyle = {
        padding: adjustToSize(12, size),
        backgroundColor: itemBgColor,
        color: itemTextColor,
        borderRadius: itemBorderRadius,
        cursor: "pointer",
        marginTop: adjustToSize(16, size),
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: adjustToSize(8, size),
        fontSize: adjustToSize(14, size),
        fontFamily: fontFamily !== "" ? fontFamily : null,
        transition: "all 0.2s ease",
    }

    const noTimesContainerStyle = {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center" as const,
    }

    return (
        <div style={containerStyle}>
            <style>
                {`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                `}
            </style>

            {isLoading ? (
                <div style={loadingContainerStyle}>
                    <div style={spinnerStyle} />
                </div>
            ) : times.length < 1 ? (
                <div style={noTimesContainerStyle}>
                    <div style={noTimesStyle}>{noTimesText}</div>
                    {(() => {
                        const nextAvailableDate = getNextAvailableDate()
                        return nextAvailableDate ? (
                            <button
                                onClick={handleGoToNextAvailableDate}
                                style={goToDateButtonStyle}
                            >
                                {/* Calendar icon SVG */}
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M3.5 2.5V1.5C3.5 1.22386 3.72386 1 4 1C4.27614 1 4.5 1.22386 4.5 1.5V2.5H11.5V1.5C11.5 1.22386 11.7239 1 12 1C12.2761 1 12.5 1.22386 12.5 1.5V2.5H13.5C14.0523 2.5 14.5 2.94772 14.5 3.5V13.5C14.5 14.0523 14.0523 14.5 13.5 14.5H2.5C1.94772 14.5 1.5 14.0523 1.5 13.5V3.5C1.5 2.94772 1.94772 2.5 2.5 2.5H3.5ZM2.5 3.5V5.5H13.5V3.5H2.5ZM13.5 6.5H2.5V13.5H13.5V6.5Z"
                                        fill="currentColor"
                                    />
                                </svg>
                                {formatDateForDisplay(nextAvailableDate)}
                            </button>
                        ) : null
                    })()}
                </div>
            ) : (
                <div style={dateGridStyle}>
                    {times.map((time, index) => {
                        const isSelected = selectedTime
                            ? selectedTime.resourceID === time.resourceID &&
                            selectedTime.timeSlot.startTime ===
                            time.timeSlot.startTime
                            : false
                        const key =
                            time.resourceID + "_" + time.timeSlot.startTime

                        const formattedTime = new Intl.DateTimeFormat(locale, {
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone: timeZone,
                        }).format(new Date(time.timeSlot.startTime))

                        return (
                            <button
                                key={key}
                                onClick={() => handleSelectedTime(time)}
                                style={getTimeButtonStyle(isSelected)}
                            >
                                <span
                                    style={{
                                        ...body1,
                                        fontSize: adjustToSize(17, size),
                                        color: isSelected
                                            ? itemSelectedTextColor
                                            : itemTextColor,
                                    }}
                                >
                                    {formattedTime}
                                </span>
                                {time.timeSlot.price && (
                                    <span
                                        style={{
                                            ...body2,
                                            fontSize: adjustToSize(14, size),
                                            paddingTop: adjustToSize(4, size),
                                            color: isSelected
                                                ? itemSelectedSecondaryTextColor
                                                : itemSecondaryTextColor,
                                        }}
                                    >
                                        {formatPrice(
                                            time.timeSlot.price.amount,
                                            time.timeSlot.price.currency
                                        )}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// FormView Component
interface FormViewProps {
    size: "sm" | "md" | "lg"
    backgroundColor: string
    primaryColor: string
    secondaryColor: string
    padding: string
    border: { borderWidth: number; borderColor: string; borderStyle: string }
    borderRadius: number
    itemBgColor: string
    itemBorderRadius: string
    itemTextColor: string
    fontFamily: string
    title: string
    subtitle: string
    firstName?: string
    lastName?: string
    email?: string
    fields: CustomFormField[]
    enabled: boolean
    guestFormEnabled?: boolean
    onDataChange?: (data: { [key: string]: any }) => void
    onBack?: () => void
    error?: string
}

interface FormViewRef {
    validateForm: () => FormValidation
}

const FormView = forwardRef<FormViewRef, FormViewProps>(
    (
        {
            size,
            backgroundColor,
            primaryColor,
            secondaryColor,
            padding,
            border,
            borderRadius,
            itemBgColor,
            itemBorderRadius,
            itemTextColor,
            fontFamily,
            title,
            subtitle,
            firstName = "First Name",
            lastName = "Last Name",
            email = "Email",
            fields,
            enabled,
            guestFormEnabled = false,
            error,
            onDataChange,
            onBack,
        },
        ref
    ) => {
        const [formData, setFormData] = useState<{ [key: string]: any }>({})
        const [guestData, setGuestData] = useState<{ [key: string]: any }>({}) // Separate state for guest fields
        const [formErrors, setFormErrors] = useState<{ [key: string]: string }>(
            {}
        )
        const [focusedInput, setFocusedInput] = useState<string | null>(null)

        // Guest form fields
        const guestFields: CustomFormField[] = guestFormEnabled
            ? [
                {
                    placeholderText: firstName,
                    type: "text",
                    inputWidth: "auto / span 1",
                    required: true,
                    labelText: "firstName",
                    errorText: "First name is required",
                },
                {
                    placeholderText: lastName,
                    type: "text",
                    inputWidth: "auto / span 1",
                    required: false,
                    labelText: "lastName",
                    errorText: "Last name is required",
                },
                {
                    placeholderText: email,
                    type: "text",
                    inputWidth: "auto / span 2",
                    required: true,
                    labelText: "email",
                    errorText: "Email is required",
                },
            ]
            : []

        const allFields = [...guestFields, ...fields]

        const validateField = (
            field: CustomFormField,
            value: any
        ): string | null => {
            if (field.required && (!value || value.length === 0)) {
                return field.errorText || "This field is required"
            } else if (!field.required) {
                return null
            }

            switch (field.type) {
                case "url":
                    try {
                        new URL(value)
                    } catch {
                        return "Please enter a valid URL"
                    }
                    break
                case "number":
                    if (value && isNaN(value)) {
                        return "Please enter a valid number"
                    }
                    break
                case "phone":
                    if (value && !/^\+?[\d\s-()]+$/.test(value)) {
                        return "Please enter a valid phone number"
                    }
                    break
            }

            return null
        }

        const validateForm = (): FormValidation => {
            const errors: { [key: string]: string } = {}
            let isValid = true

            allFields.forEach((field) => {
                const isGuestField = [
                    "firstName",
                    "lastName",
                    "email",
                ].includes(field.labelText)
                const value = isGuestField
                    ? guestData[field.labelText]
                    : formData[field.labelText]
                const error = validateField(field, value)
                if (error) {
                    errors[field.labelText] = error
                    isValid = false
                }
            })

            setFormErrors(errors)
            return { isValid, errors }
        }

        useImperativeHandle(ref, () => ({
            validateForm,
        }))

        const handleInputChange = (key: string, value: any) => {
            const isGuestField = ["firstName", "lastName", "email"].includes(
                key
            )

            if (isGuestField) {
                const newGuestData = { ...guestData, [key]: value }
                setGuestData(newGuestData)
                // Combine guest data with form data for the callback
                onDataChange?.({ ...formData, ...newGuestData })
            } else {
                const newFormData = { ...formData, [key]: value }
                setFormData(newFormData)
                // Combine form data with guest data for the callback
                onDataChange?.({ ...newFormData, ...guestData })
            }
        }

        // Get value for input field
        const getFieldValue = (field: CustomFormField) => {
            const isGuestField = ["firstName", "lastName", "email"].includes(
                field.labelText
            )
            return isGuestField
                ? guestData[field.labelText] || ""
                : formData[field.labelText] || ""
        }

        const containerStyle = {
            width: "100%",
            margin: "0 auto",
            padding: padding,
            backgroundColor: backgroundColor,
            borderWidth: border.borderWidth,
            borderColor: border.borderColor,
            borderStyle: border.borderStyle,
            borderRadius: borderRadius,
        }

        const headerContainerStyle = {
            marginBottom: adjustToSize(20, size),
            gap: adjustToSize(12, size),
        }

        const navigationButtonStyle = {
            background: "none",
            border: "0px",
            cursor: "pointer",
            minWidth: "40px",
            padding: "12px 0",
            display: "flex",
            alignItems: "start",
            justifyContent: "start",
            height: "40px",
        }

        const titleStyle = {
            ...headline2,
            fontSize: adjustToSize(18, size),
            marginTop: "8px",
            color: primaryColor,
        }

        const subtitleStyle = {
            ...body1,
            fontSize: adjustToSize(16, size),
            color: secondaryColor,
            marginBottom: 0,
        }

        const formGridStyle = {
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: adjustToSize(16, size),
        }

        const getInputStyle = (inputName: string) => ({
            ...body1,
            width: "100%",
            color: itemTextColor,
            padding: adjustToSize(12, size),
            fontSize: adjustToSize(17, size),
            border:
                focusedInput === inputName
                    ? `1px solid ${primaryColor}`
                    : "none",
            borderRadius: itemBorderRadius,
            outline: "none",
            opacity: !enabled ? "0.7" : "1",
            backgroundColor:
                focusedInput === inputName ? backgroundColor : itemBgColor,
            transition: "border-color 0.2s ease",
        })

        const labelStyle = {
            ...body2,
            display: "block",
            marginBottom: adjustToSize(4, size),
            color: secondaryColor,
            fontSize: adjustToSize(14, size),
            fontFamily: fontFamily || "inherit",
        }

        const errorMessageStyle = {
            ...body2,
            color: "red",
            fontSize: adjustToSize(12, size),
            marginTop: adjustToSize(4, size),
        }

        const renderField = (field: CustomFormField) => {
            const options =
                field.options?.split(",").map((opt) => opt.trim()) || []
            const fieldValue = getFieldValue(field)

            switch (field.type) {
                case "textarea":
                    return (
                        <textarea
                            value={fieldValue}
                            onChange={(e) =>
                                handleInputChange(
                                    field.labelText,
                                    e.target.value
                                )
                            }
                            placeholder={field.placeholderText}
                            style={{
                                ...getInputStyle(field.labelText),
                                minHeight: adjustToSize(120, size),
                                resize: "vertical" as const,
                            }}
                            disabled={!enabled}
                            onFocus={() => setFocusedInput(field.labelText)}
                            onBlur={() => setFocusedInput(null)}
                        />
                    )
                case "select":
                    return (
                        <select
                            value={fieldValue}
                            onChange={(e) =>
                                handleInputChange(
                                    field.labelText,
                                    e.target.value
                                )
                            }
                            style={{
                                ...getInputStyle(field.labelText),
                                cursor: "pointer",
                                appearance: "none",
                            }}
                            disabled={!enabled}
                            onFocus={() => setFocusedInput(field.labelText)}
                            onBlur={() => setFocusedInput(null)}
                        >
                            <option value="">{field.placeholderText}</option>
                            {options.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                    )
                case "multiselect":
                    const selectedValues = Array.isArray(fieldValue)
                        ? fieldValue
                        : []
                    return (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: adjustToSize(8, size),
                                padding: adjustToSize(8, size),
                                backgroundColor: itemBgColor,
                                borderRadius: itemBorderRadius,
                            }}
                        >
                            {options.map((opt) => (
                                <label
                                    key={opt}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: adjustToSize(8, size),
                                        color: itemTextColor,
                                        cursor: enabled ? "pointer" : "default",
                                        opacity: enabled ? 1 : 0.7,
                                        fontSize: adjustToSize(14, size),
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedValues.includes(opt)}
                                        onChange={(e) => {
                                            const isChecked = e.target.checked
                                            const updatedValues = isChecked
                                                ? [...selectedValues, opt]
                                                : selectedValues.filter(
                                                    (val: string) =>
                                                        val !== opt
                                                )
                                            handleInputChange(
                                                field.labelText,
                                                updatedValues
                                            )
                                        }}
                                        style={{
                                            width: adjustToSize(18, size),
                                            height: adjustToSize(18, size),
                                            cursor: enabled
                                                ? "pointer"
                                                : "default",
                                        }}
                                        disabled={!enabled}
                                    />
                                    {opt}
                                </label>
                            ))}
                        </div>
                    )
                case "number":
                    return (
                        <input
                            type="number"
                            value={fieldValue}
                            onChange={(e) =>
                                handleInputChange(
                                    field.labelText,
                                    e.target.value
                                )
                            }
                            placeholder={field.placeholderText}
                            style={getInputStyle(field.labelText)}
                            disabled={!enabled}
                            onFocus={() => setFocusedInput(field.labelText)}
                            onBlur={() => setFocusedInput(null)}
                        />
                    )
                default:
                    return (
                        <input
                            type={field.type}
                            value={fieldValue}
                            onChange={(e) =>
                                handleInputChange(
                                    field.labelText,
                                    e.target.value
                                )
                            }
                            placeholder={field.placeholderText}
                            style={getInputStyle(field.labelText)}
                            disabled={!enabled}
                            onFocus={() => setFocusedInput(field.labelText)}
                            onBlur={() => setFocusedInput(null)}
                        />
                    )
            }
        }

        return (
            <div style={containerStyle}>
                <div style={headerContainerStyle}>
                    {onBack && (
                        <button onClick={onBack} style={navigationButtonStyle}>
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                            >
                                <path
                                    d="M9.5 12L5.5 8L9.5 4"
                                    stroke={primaryColor}
                                    strokeOpacity="0.5"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </button>
                    )}
                    <h2 style={titleStyle}>{title}</h2>
                    <p style={subtitleStyle}>{subtitle}</p>
                </div>

                {error && (
                    <div
                        style={{
                            padding: "12px",
                            marginBottom: "16px",
                            backgroundColor: "#fee2e2",
                            color: "#dc2626",
                            borderRadius: "6px",
                        }}
                    >
                        {error}
                    </div>
                )}

                <div style={formGridStyle}>
                    {allFields.map((field) => (
                        <div
                            key={field.labelText}
                            style={{ gridColumn: field.inputWidth }}
                        >
                            {field.labelText &&
                                !["firstName", "lastName", "email"].includes(
                                    field.labelText
                                ) && (
                                    <label style={labelStyle}>
                                        {field.labelText}
                                        {field.required && " *"}
                                    </label>
                                )}
                            {renderField(field)}
                            {formErrors[field.labelText] && (
                                <div style={errorMessageStyle}>
                                    {formErrors[field.labelText]}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )
    }
)

// ResourcePicker Component
interface Resource {
    id: string
    name: string
}

interface ResourcePickerProps {
    title: string
    size: "sm" | "md" | "lg"
    backgroundColor: string
    borderRadius: number
    border: { borderWidth: number; borderColor: string; borderStyle: string }
    padding: string
    itemBgColor: string
    itemSelectColor: string
    itemTextColor: string
    itemSecondaryTextColor: string
    itemSelectedTextColor: string
    itemBorderRadius: string
    fontFamily: string
    anyResourceText: string
    isLoading?: boolean
    resources: Resource[]
    selectedResourceID?: string
    onResourceChange?: (resource?: Resource) => void
}

const ResourcePicker: React.FC<ResourcePickerProps> = ({
                                                           title,
                                                           size,
                                                           backgroundColor,
                                                           borderRadius,
                                                           border,
                                                           padding,
                                                           itemBgColor,
                                                           itemSelectColor,
                                                           itemTextColor,
                                                           itemSecondaryTextColor,
                                                           itemBorderRadius,
                                                           fontFamily,
                                                           anyResourceText,
                                                           isLoading = false,
                                                           resources = [],
                                                           selectedResourceID,
                                                           onResourceChange,
                                                       }) => {
    const [selectedResource, setSelectedResource] = useState<
        Resource | undefined
    >(undefined)

    useEffect(() => {
        if (
            selectedResourceID &&
            selectedResourceID !== "" &&
            resources.length > 0
        ) {
            const preselectedResource = resources.find(
                (r) => r.id === selectedResourceID
            )
            if (preselectedResource) {
                setSelectedResource(preselectedResource)
            }
        } else if (!selectedResourceID || selectedResourceID === "") {
            setSelectedResource(undefined)
        }
    }, [selectedResourceID, resources])

    const containerRef = useRef(null)

    const handleSelectedResource = (resourceId: string) => {
        if (resourceId === "") {
            onResourceChange?.(undefined)
        }
        const resource = resources.find((r) => r.id === resourceId)
        setSelectedResource(resource)
        onResourceChange?.(resource)
    }

    const containerStyle = {
        width: "100%",
        padding: padding,
        backgroundColor: backgroundColor,
        borderRadius: borderRadius,
        borderColor: border.borderColor,
        borderWidth: border.borderWidth,
        borderStyle: border.borderStyle,
    }

    const contentStyle = {
        display: "flex",
        flexDirection: "row" as const,
        alignItems: "center",
        gap: adjustToSize(16, size),
    }

    const titleStyle = {
        ...body2,
        fontFamily: fontFamily !== "" ? fontFamily : null,
        fontSize: adjustToSize(17, size),
        color: itemSecondaryTextColor,
        flex: "1",
    }

    const selectStyle = {
        ...body1,
        fontFamily: fontFamily !== "" ? fontFamily : null,
        minWidth: "160px",
        padding: `${adjustToSize(8, size)} ${adjustToSize(12, size)}`,
        paddingRight: adjustToSize(32, size),
        fontSize: adjustToSize(17, size),
        backgroundColor: itemBgColor,
        border: "none",
        borderRadius: itemBorderRadius,
        color: itemTextColor,
        outline: "none",
        cursor: "pointer",
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(itemTextColor)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: `right ${adjustToSize(8, size)} center`,
        backgroundSize: adjustToSize(16, size),
    }

    const loadingStyle = {
        color: itemTextColor,
        fontSize: adjustToSize(14, size),
    }

    return (
        <div style={containerStyle} ref={containerRef}>
            <div style={contentStyle}>
                <div style={titleStyle}>{title}</div>

                {isLoading ? (
                    <div style={loadingStyle}>Loading...</div>
                ) : (
                    <select
                        value={selectedResource?.id || ""}
                        onChange={(e) => handleSelectedResource(e.target.value)}
                        style={selectStyle}
                        disabled={resources.length === 0}
                    >
                        <option value="">{anyResourceText}</option>
                        {resources.map((resource) => (
                            <option key={resource.id} value={resource.id}>
                                {resource.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>
        </div>
    )
}

// AcceptTerms Component
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
        ...body2,
        fontSize: adjustToSize(17, size),
        color: itemSecondaryTextColor,
        fontFamily: fontFamily || "inherit",
        margin: 0,
    }

    const linkStyle = {
        ...body2,
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

// ============================================================================
// MAIN FLEXIBLE BOOKING COMPONENT
// ============================================================================

interface FlexibleBookingProps {
    // Core settings
    size: "sm" | "md" | "lg"
    backgroundColor: string
    primaryColor: string
    secondaryColor: string
    fontFamily: string
    locale: string
    guestMode: boolean
    localTime: boolean

    // Styling
    item: {
        bgColor: string
        selectColor: string
        selectedTextColor: string
        selectedSecondaryTextColor: string
        borderRadius: string
    }
    button: {
        bgColor: string
        textColor: string
        borderRadius: number
    }
    blocks: {
        gap: number
        padding: string
        border: {
            borderWidth: number
            borderStyle: string
            borderColor: string
        }
        borderRadius: number
    }

    // Date picker settings
    datesCount: {
        min: number
        max: number
    }

    // Duration settings
    durations: {
        step: {
            hours: number
            minutes: number
        }
        min: {
            hours: number
            minutes: number
        }
        max: {
            hours: number
            minutes: number
        }
    }

    // Resource picker
    resourcePicker: {
        visible: boolean
        selectResourceText: string
        anyResourceText: string
    }

    // Forms
    guestModeTexts: {
        title: string
        subtitle: string
        firstName: string
        lastName: string
        email: string
    }
    customForm: {
        formTitle: string
        formSubtitle: string
        fields: CustomFormField[]
    }

    // Terms
    showTerms: boolean
    terms: {
        text: string
        highlightedText: string
        termsLink: string
    }

    // Texts
    texts: {
        noTimes: string
        continue: string
        makeBooking: string
        loginToBook: string
        durationText: string
    }

    // API settings
    bkla: {
        apiRegion: "us" | "eu"
        apiKey: string
        companyID: string
    }
    serviceID: string
    selectedDate?: string
    selectedResourceID?: string
    clientTokens?: { [key: string]: any }

    // Routes
    routes: {
        confirmed: string
        pending: string
    }
}

// Singleton SDK instance
let sdkInstance: BooklaSDK | null = null

const useBookla = (apiUrl: string, apiKey: string) => {
    return useMemo(() => {
        if (sdkInstance) {
            sdkInstance = null
        }
        sdkInstance = new BooklaSDK({
            apiUrl: apiUrl,
            apiKey: apiKey,
            debug: false,
            retry: {
                maxAttempts: 3,
                delayMs: 1000,
                statusCodesToRetry: [408, 429, 500, 502, 503, 504],
            },
        })
        return sdkInstance
    }, [apiUrl, apiKey])
}

const formatSlots = (response: any): TimeSlotWithResource[] => {
    const times = response["times"]
    const resourceIDs = Object.keys(times)

    let timeSlots = resourceIDs.flatMap((resourceID) => {
        return times[resourceID].map((time: any) => {
            return {
                timeSlot: time,
                resourceID: resourceID,
            }
        })
    })

    timeSlots = timeSlots
        .sort((a, b) => {
            return (
                new Date(a.timeSlot.startTime).getTime() -
                new Date(b.timeSlot.startTime).getTime()
            )
        })
        .filter((time, index, self) => {
            return (
                index ===
                self.findIndex(
                    (t) =>
                        new Date(t.timeSlot.startTime).toLocaleTimeString() ===
                        new Date(time.timeSlot.startTime).toLocaleTimeString()
                )
            )
        })

    return timeSlots
}

function FlexibleBookingComponent(props: FlexibleBookingProps) {
    const { navigate, routes } = useRouter()
    const apiUrl = "https://" + props.bkla.apiRegion + ".bookla.com/api"
    const bookla = useBookla(apiUrl, props.bkla.apiKey)

    // State management
    const [currentStep, setCurrentStep] = useState<BookingStep>(
        BookingStep.Date
    )
    const [loading, setLoading] = useState(false)
    const [submiting, setSubmiting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [serviceLoaded, setServiceLoaded] = useState(false)

    // Booking data
    const [timeSlots, setTimeSlots] = useState<TimeSlotWithResource[]>([])
    const [selectedTime, setSelectedTime] = useState<TimeSlotWithResource>(null)
    const [resources, setResources] = useState([])
    const [timeZone, setTimeZone] = useState(
        Intl.DateTimeFormat().resolvedOptions().timeZone
    )
    const [availableDates, setAvailableDates] = useState<string[]>([])

    // Selection state
    const preselectedDate = () => {
        if (props.selectedDate === undefined) {
            return new Date()
        }
        let presDate = new Date(props.selectedDate)
        let curDate = new Date()
        return presDate.getTime() < curDate.getTime() ? curDate : presDate
    }

    const [selectedDate, setSelectedDate] = useState(preselectedDate())
    const [selectedResourceID, setSelectedResourceID] = useState<string | null>(
        props.selectedResourceID && props.selectedResourceID !== ""
            ? props.selectedResourceID
            : null
    )

    // Duration state
    const [currentDuration, setCurrentDuration] = useState<Duration>({
        days: 0,
        hours: props.durations.min.hours,
        minutes: props.durations.min.minutes,
    })

    // Form state
    const [clientData, setClientData] = useState<ClientData>(null)
    const [formData, setFormData] = useState<{ [key: string]: any }>({})
    const [termsAccepted, setTermsAccepted] = useState<boolean>(false)

    // Refs
    const datePickerRef = useRef<DatePickerRef>(null)
    const formRef = useRef<{ validateForm: () => FormValidation }>()

    const clientUUID = uuid()
    const isAuthorized = bookla.isAuthenticated().accessToken !== undefined

    // ============================================================================
    // EFFECT HOOKS
    // ============================================================================

    useEffect(() => {
        if (props.clientTokens) {
            bookla.setAuthTokens(props.clientTokens)
        } else {
            bookla.clearAuth()
        }
        setServiceLoaded(false) // Reset service loaded state
        loadServiceData()
    }, [props.clientTokens])

    useEffect(() => {
        if (currentStep === BookingStep.Date && serviceLoaded) {
            onDateChange(selectedDate)
        }
    }, [
        currentStep,
        selectedDate,
        selectedResourceID,
        currentDuration,
        serviceLoaded,
    ])

    useEffect(() => {
        if (currentStep === BookingStep.Success) {
            proceedToRoute(props.routes.confirmed)
        } else if (currentStep === BookingStep.Pending) {
            proceedToRoute(props.routes.pending)
        }
    }, [currentStep])

    useEffect(() => {
        if (serviceLoaded) {
            fetchAvailableDates()
        }
    }, [selectedResourceID, currentDuration, serviceLoaded])

    // ============================================================================
    // HANDLER FUNCTIONS
    // ============================================================================

    const loadServiceData = async () => {
        if (props.bkla.companyID === "" || props.serviceID === "") {
            return
        }

        setLoading(true)
        setError(null)
        setServiceLoaded(false)

        try {
            const response = await bookla.services.get(
                props.bkla.companyID,
                props.serviceID
            )

            // Check if service type is flexible
            if (response.type && response.type !== "flexible") {
                setError(
                    `This component only supports flexible-duration services. Service type '${response.type}' is not supported.`
                )
                setServiceLoaded(false)
                return
            }

            setResources(response.resources ?? [])
            if (response.timeZone && props.localTime === true) {
                setTimeZone(response.timeZone)
            }
            setServiceLoaded(true)
        } catch (err) {
            setError("Failed to load service data: " + err)
            setServiceLoaded(false)
        } finally {
            setLoading(false)
        }
    }

    const fetchAvailableDates = async () => {
        if (
            props.bkla.companyID === "" ||
            props.serviceID === "" ||
            !serviceLoaded
        ) {
            setAvailableDates([])
            return
        }

        try {
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            const threeMonthsLater = new Date(today)
            threeMonthsLater.setMonth(today.getMonth() + 3)
            threeMonthsLater.setHours(23, 59, 59, 999)

            const params: any = {
                from: today.toISOString(),
                to: threeMonthsLater.toISOString(),
                duration: durationToISO(currentDuration),
            }

            if (selectedResourceID) {
                params.resourceIDs = [selectedResourceID]
            }

            const response = await bookla.services.getDates(
                props.bkla.companyID,
                props.serviceID,
                params
            )

            const allDates = Object.values(response.dates).flat()
            const uniqueDates = [...new Set(allDates)].sort()
            setAvailableDates(uniqueDates as string[])
        } catch (err) {
            console.error("Failed to load available dates:", err)
            setAvailableDates([])
        }
    }

    const onDateChange = useCallback(
        async (date: Date) => {
            if (
                props.bkla.companyID === "" ||
                props.serviceID === "" ||
                !serviceLoaded
            ) {
                return
            }

            setLoading(true)
            setError(null)
            setSelectedTime(null)

            const startOfTheDay = new Date(date.setHours(0, 0, 0))
            const endOfTheDay = new Date(startOfTheDay)
            endOfTheDay.setDate(startOfTheDay.getDate() + 1)

            if (
                currentDuration.hours > 1 ||
                (currentDuration.hours === 1 && currentDuration.minutes > 0)
            ) {
                const durationMs =
                    (currentDuration.hours - 1) * 3600000 +
                    currentDuration.minutes * 60000
                endOfTheDay.setTime(endOfTheDay.getTime() + durationMs)
                if (currentDuration.days > 0) {
                    endOfTheDay.setDate(
                        endOfTheDay.getDate() + currentDuration.days
                    )
                }
            }

            if (props.localTime === true) {
                const offsetMinutes = getTimezoneOffset(timeZone, date)
                startOfTheDay.setTime(
                    startOfTheDay.getTime() - offsetMinutes * 60 * 1000
                )
                endOfTheDay.setTime(
                    endOfTheDay.getTime() - offsetMinutes * 60 * 1000
                )
            }

            try {
                const params: any = {
                    from: startOfTheDay.toISOString(),
                    to: endOfTheDay.toISOString(),
                    resourceIDs: selectedResourceID ? [selectedResourceID] : [],
                    duration: durationToISO(currentDuration),
                }

                const response = await bookla.services.getTimes(
                    props.bkla.companyID,
                    props.serviceID,
                    params
                )
                const slots = formatSlots(response)
                setTimeSlots(slots)
            } catch (err) {
                setError("Failed to load times: " + err)
            } finally {
                setLoading(false)
            }
        },
        [
            props.bkla.companyID,
            props.serviceID,
            props.localTime,
            timeZone,
            selectedResourceID,
            currentDuration,
            serviceLoaded,
        ]
    )

    const makeBooking = async () => {
        if (selectedTime === null) {
            return
        }

        setSubmiting(true)
        setError(null)

        try {
            let data: any = {
                companyID: props.bkla.companyID,
                serviceID: props.serviceID,
                resourceID: selectedTime.resourceID,
                startTime: new Date(
                    selectedTime.timeSlot.startTime
                ).toISOString(),
                duration: durationToISO(currentDuration),
            }

            if (Object.keys(formData).length > 0) {
                data.metaData = formData
            }

            if (props.guestMode) {
                data.client = clientData
            }

            const response = await bookla.bookings.request(data)

            if (response.paymentURL && response.paymentURL.length > 0) {
                window.location.href = response.paymentURL
            } else if (response.status === "confirmed") {
                setCurrentStep(BookingStep.Success)
            } else if (response.status === "pending") {
                setCurrentStep(BookingStep.Pending)
            }
        } catch (err) {
            setError("Failed to request booking: " + err)
        } finally {
            setSubmiting(false)
        }
    }

    const handleFormDataChange = (data: { [key: string]: any }) => {
        handleClientDataChange({
            email: data["email"] ?? "",
            firstName: data["firstName"],
            lastName: data["lastName"],
        })

        delete data["email"]
        delete data["firstName"]
        delete data["lastName"]

        setFormData(data)
    }

    const handleClientDataChange = (data: ClientData) => {
        if (data.email !== "") {
            data.id = clientUUID
            setClientData(data)
        } else {
            setClientData(null)
        }
    }

    const proceedToRoute = (route: any) => {
        let routeId = getRouteId(routes, route)
        if (routeId === "") {
            routeId = getRouteId(routes, "/")
        }
        navigate(routeId, "")
    }

    // ============================================================================
    // STEP NAVIGATION
    // ============================================================================

    const proceedToNextStep = () => {
        if (currentStep === BookingStep.Date) {
            // Check if we need to show forms (either guest mode or custom fields)
            if (props.guestMode || props.customForm.fields?.length > 0) {
                setCurrentStep(BookingStep.Form)
                return
            }
            // No forms needed, proceed directly to booking
            return makeBooking()
        }

        if (currentStep === BookingStep.Form) {
            const validation = formRef.current?.validateForm()
            if (!validation?.isValid) {
                return
            }
            return makeBooking()
        }
    }

    const proceedToPreviousStep = () => {
        if (currentStep === BookingStep.Form) {
            setCurrentStep(BookingStep.Date)
            return
        }
    }

    // ============================================================================
    // RENDER HELPERS
    // ============================================================================

    const getButtonTitle = () => {
        if (
            currentStep === BookingStep.Date &&
            (props.guestMode || props.customForm.fields?.length > 0)
        ) {
            return props.texts.continue
        }
        return props.texts.makeBooking
    }

    const bookButtonEnabled =
        !submiting &&
        (isAuthorized || props.guestMode) &&
        (currentStep !== BookingStep.Date || selectedTime !== null) &&
        (!props.showTerms || termsAccepted)

    const containerStyle = {
        height: "100%",
        width: "100%",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    }

    const buttonStyle = (isDisabled: boolean) => ({
        ...headline2,
        fontFamily: props.fontFamily !== "" ? props.fontFamily : null,
        width: "100%",
        margin: "0 auto",
        border: "none",
        padding: adjustToSize(16, props.size),
        backgroundColor: props.button.bgColor,
        color: props.button.textColor,
        fontSize: adjustToSize(17, props.size),
        borderRadius: props.button.borderRadius,
        opacity: isDisabled || submiting ? 0.2 : 1,
        cursor: submiting ? "not-allowed" : "pointer",
    })

    // ============================================================================
    // MAIN RENDER
    // ============================================================================

    // Show loading state while service data is being loaded
    if (!serviceLoaded && loading) {
        return (
            <div style={containerStyle}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: "40px",
                        color: props.secondaryColor,
                        fontSize: adjustToSize(16, props.size),
                        fontFamily: props.fontFamily || "inherit",
                    }}
                >
                    Loading service configuration...
                </div>
            </div>
        )
    }

    // Show error state if service failed to load
    if (!serviceLoaded && error) {
        return (
            <div style={containerStyle}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: "40px",
                        color: "red",
                        fontSize: adjustToSize(16, props.size),
                        fontFamily: props.fontFamily || "inherit",
                        textAlign: "center",
                    }}
                >
                    {error}
                </div>
            </div>
        )
    }

    return (
        <div style={containerStyle}>
            <style>
                {`
                @keyframes spin {
                    0% { transform: translateY(-50%) rotate(0deg); }
                    100% { transform: translateY(-50%) rotate(360deg); }
                }
                `}
            </style>

            {/* Form Step */}
            {currentStep === BookingStep.Form && (
                <FormView
                    ref={formRef}
                    size={props.size}
                    backgroundColor={props.backgroundColor}
                    primaryColor={props.primaryColor}
                    secondaryColor={props.secondaryColor}
                    padding={props.blocks.padding}
                    border={props.blocks.border}
                    borderRadius={props.blocks.borderRadius}
                    itemTextColor={props.primaryColor}
                    itemBgColor={props.item.bgColor}
                    itemBorderRadius={props.item.borderRadius}
                    enabled={!submiting}
                    onDataChange={handleFormDataChange}
                    error={error}
                    fields={props.customForm.fields}
                    fontFamily={props.fontFamily}
                    title={
                        props.guestMode
                            ? props.guestModeTexts.title
                            : props.customForm.formTitle
                    }
                    subtitle={
                        props.guestMode
                            ? props.guestModeTexts.subtitle
                            : props.customForm.formSubtitle
                    }
                    firstName={props.guestModeTexts.firstName}
                    lastName={props.guestModeTexts.lastName}
                    email={props.guestModeTexts.email}
                    onBack={proceedToPreviousStep}
                    guestFormEnabled={props.guestMode}
                />
            )}

            {/* Date/Time Selection Step */}
            {currentStep === BookingStep.Date && (
                <>
                    <DatePicker
                        ref={datePickerRef}
                        size={props.size}
                        padding={props.blocks.padding}
                        startOnMonday={true}
                        primary={props.primaryColor}
                        onDateChange={(date) => {
                            setSelectedDate(date)
                        }}
                        border={props.blocks.border}
                        borderRadius={props.blocks.borderRadius}
                        backgroundColor={props.backgroundColor}
                        itemBgColor={props.item.bgColor}
                        itemSelectColor={props.item.selectColor}
                        itemTextColor={props.primaryColor}
                        itemSecondaryTextColor={props.secondaryColor}
                        itemSelectedTextColor={props.item.selectedTextColor}
                        itemSelectedSecondaryTextColor={
                            props.item.selectedSecondaryTextColor
                        }
                        itemBorderRadius={props.item.borderRadius}
                        fontFamily={props.fontFamily}
                        value={selectedDate}
                        locale={props.locale}
                        minDates={props.datesCount?.min ?? 3}
                        maxDates={props.datesCount?.max ?? 7}
                        availableDates={availableDates}
                    />

                    {/* Duration Picker */}
                    <div
                        style={{
                            padding: adjustToSize(props.blocks.gap, props.size),
                        }}
                    ></div>
                    <DurationPicker
                        size={props.size}
                        title={props.texts.durationText}
                        padding={props.blocks.padding}
                        backgroundColor={props.backgroundColor}
                        border={props.blocks.border}
                        borderRadius={props.blocks.borderRadius}
                        itemBgColor={props.item.bgColor}
                        fontFamily={props.fontFamily}
                        itemSelectColor={props.item.selectColor}
                        itemTextColor={props.primaryColor}
                        itemSecondaryTextColor={props.secondaryColor}
                        itemBorderRadius={props.item.borderRadius}
                        locale={props.locale}
                        minDuration={{
                            days: 0,
                            hours: props.durations.min.hours,
                            minutes: props.durations.min.minutes,
                        }}
                        stepDuration={{
                            days: 0,
                            hours: props.durations.step.hours,
                            minutes: props.durations.step.minutes,
                        }}
                        maxDuration={{
                            days: 0,
                            hours: props.durations.max.hours,
                            minutes: props.durations.max.minutes,
                        }}
                        onDurationChange={setCurrentDuration}
                    />

                    {/* Resource Picker */}
                    {props.resourcePicker.visible && (
                        <>
                            <div
                                style={{
                                    padding: adjustToSize(
                                        props.blocks.gap,
                                        props.size
                                    ),
                                }}
                            ></div>
                            <ResourcePicker
                                size={props.size}
                                padding={props.blocks.padding}
                                title={props.resourcePicker.selectResourceText}
                                backgroundColor={props.backgroundColor}
                                border={props.blocks.border}
                                borderRadius={props.blocks.borderRadius}
                                itemBgColor={props.item.bgColor}
                                itemSelectColor={props.item.selectColor}
                                itemSecondaryTextColor={props.secondaryColor}
                                itemTextColor={props.primaryColor}
                                itemBorderRadius={props.item.borderRadius}
                                itemSelectedTextColor={
                                    props.item.selectedTextColor
                                }
                                anyResourceText={
                                    props.resourcePicker.anyResourceText
                                }
                                fontFamily={props.fontFamily}
                                resources={resources}
                                selectedResourceID={selectedResourceID}
                                onResourceChange={(resource) =>
                                    setSelectedResourceID(
                                        resource ? resource.id : null
                                    )
                                }
                            />
                        </>
                    )}

                    <div
                        style={{
                            padding: adjustToSize(props.blocks.gap, props.size),
                        }}
                    ></div>

                    <TimePicker
                        size={props.size}
                        padding={props.blocks.padding}
                        isLoading={loading}
                        backgroundColor={props.backgroundColor}
                        border={props.blocks.border}
                        borderRadius={props.blocks.borderRadius}
                        itemBgColor={props.item.bgColor}
                        itemSelectColor={props.item.selectColor}
                        itemTextColor={props.primaryColor}
                        itemSecondaryTextColor={props.secondaryColor}
                        itemSelectedTextColor={props.item.selectedTextColor}
                        itemSelectedSecondaryTextColor={
                            props.item.selectedSecondaryTextColor
                        }
                        itemBorderRadius={props.item.borderRadius}
                        fontFamily={props.fontFamily}
                        locale={props.locale}
                        times={timeSlots}
                        timeZone={timeZone}
                        noTimesText={props.texts.noTimes}
                        onTimeChange={setSelectedTime}
                        availableDates={availableDates}
                        selectedDate={selectedDate}
                        onDateChange={(newDate) => {
                            // Call the DatePicker's doChangeDate method directly
                            datePickerRef.current?.doChangeDate(newDate)
                            // Also call the original onDateChange
                            onDateChange(newDate)
                        }}
                    />

                    {/* Terms and Conditions */}
                    {props.showTerms && (
                        <>
                            <div
                                style={{
                                    padding: adjustToSize(
                                        props.blocks.gap,
                                        props.size
                                    ),
                                }}
                            ></div>
                            <AcceptTerms
                                padding={props.blocks.padding}
                                size={props.size}
                                borderRadius={props.blocks.borderRadius}
                                backgroundColor={props.backgroundColor}
                                itemBgColor={props.item.bgColor}
                                itemSelectColor={props.item.selectColor}
                                itemTextColor={props.primaryColor}
                                itemSecondaryTextColor={props.secondaryColor}
                                fontFamily={props.fontFamily}
                                text={props.terms.text}
                                highlightedText={props.terms.highlightedText}
                                termsLink={props.terms.termsLink}
                                accepted={termsAccepted}
                                onAcceptChange={setTermsAccepted}
                            />
                        </>
                    )}
                </>
            )}

            <div
                style={{ padding: adjustToSize(props.blocks.gap, props.size) }}
            ></div>

            {/* Action Button */}
            {isAuthorized || props.guestMode ? (
                <button
                    style={buttonStyle(!bookButtonEnabled)}
                    disabled={!bookButtonEnabled}
                    onClick={proceedToNextStep}
                >
                    {getButtonTitle()}
                    {submiting && (
                        <div
                            style={spinnerStyle(props.item.selectedTextColor)}
                        />
                    )}
                </button>
            ) : (
                <button
                    style={buttonStyle(false)}
                    onClick={() => {
                        window.location.href = "/login"
                    }}
                >
                    {props.texts.loginToBook}
                </button>
            )}
        </div>
    )
}

// ============================================================================
// PROPERTY CONTROLS
// ============================================================================

FlexibleBookingComponent.propertyControls = {
    size: {
        type: ControlType.Enum,
        title: "Size",
        defaultValue: "md",
        options: ["sm", "md", "lg"],
        optionTitles: ["Small", "Medium", "Large"],
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "white",
    },
    primaryColor: {
        type: ControlType.Color,
        title: "Primary",
        defaultValue: "black",
    },
    secondaryColor: {
        type: ControlType.Color,
        title: "Secondary",
        defaultValue: "#666",
    },
    fontFamily: {
        type: ControlType.String,
        title: "Font Family",
        defaultValue: "Inter",
    },
    locale: {
        type: ControlType.String,
        title: "Locale",
        defaultValue: "en-US",
    },
    localTime: {
        type: ControlType.Boolean,
        title: "Use local time",
        defaultValue: true,
    },
    guestMode: {
        type: ControlType.Boolean,
        title: "Guest mode",
        defaultValue: true,
    },
    item: {
        type: ControlType.Object,
        title: "Item",
        controls: {
            bgColor: {
                type: ControlType.Color,
                title: "Bg Color",
                defaultValue: "#f5f5f5",
            },
            selectColor: {
                type: ControlType.Color,
                title: "Brand",
                defaultValue: "black",
            },
            selectedTextColor: {
                type: ControlType.Color,
                title: "Primary On Brand",
                defaultValue: "white",
            },
            selectedSecondaryTextColor: {
                type: ControlType.Color,
                title: "Secondary On Brand",
                defaultValue: "white",
            },
            borderRadius: {
                type: ControlType.BorderRadius,
                title: "Border Radius",
                defaultValue: "8px",
                step: 1,
            },
        },
    },
    button: {
        type: ControlType.Object,
        title: "Button",
        controls: {
            bgColor: {
                type: ControlType.Color,
                title: "Bg Color",
                defaultValue: "black",
            },
            textColor: {
                type: ControlType.Color,
                title: "Text color",
                defaultValue: "white",
            },
            borderRadius: {
                type: ControlType.BorderRadius,
                title: "Border Radius",
                defaultValue: "32px",
                step: 1,
            },
        },
    },
    blocks: {
        type: ControlType.Object,
        title: "Blocks",
        controls: {
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 8,
            },
            padding: {
                type: ControlType.Padding,
                title: "Padding",
                defaultValue: "20px",
            },
            border: {
                type: ControlType.Border,
                title: "Border",
                defaultValue: {
                    borderWidth: 2,
                    borderStyle: "solid",
                    borderColor: "#F5F5F5",
                },
            },
            borderRadius: {
                type: ControlType.BorderRadius,
                title: "Border Radius",
                defaultValue: "16px",
                step: 1,
            },
        },
    },
    datesCount: {
        type: ControlType.Object,
        title: "Dates count",
        controls: {
            min: { type: ControlType.Number, title: "Min", defaultValue: 3 },
            max: { type: ControlType.Number, title: "Max", defaultValue: 7 },
        },
    },
    durations: {
        type: ControlType.Object,
        title: "Durations",
        controls: {
            step: {
                type: ControlType.Object,
                title: "Step",
                controls: {
                    hours: {
                        type: ControlType.Number,
                        title: "Hours",
                        defaultValue: 0,
                        step: 1,
                    },
                    minutes: {
                        type: ControlType.Number,
                        title: "Minutes",
                        defaultValue: 30,
                        step: 1,
                        max: 59,
                    },
                },
            },
            min: {
                type: ControlType.Object,
                title: "Min",
                controls: {
                    hours: {
                        type: ControlType.Number,
                        title: "Hours",
                        defaultValue: 1,
                        step: 1,
                    },
                    minutes: {
                        type: ControlType.Number,
                        title: "Minutes",
                        defaultValue: 0,
                        step: 1,
                        max: 59,
                    },
                },
            },
            max: {
                type: ControlType.Object,
                title: "Max",
                controls: {
                    hours: {
                        type: ControlType.Number,
                        title: "Hours",
                        defaultValue: 0,
                        step: 1,
                    },
                    minutes: {
                        type: ControlType.Number,
                        title: "Minutes",
                        defaultValue: 0,
                        step: 1,
                        max: 59,
                    },
                },
            },
        },
    },
    resourcePicker: {
        type: ControlType.Object,
        title: "Resource selector",
        controls: {
            visible: {
                type: ControlType.Boolean,
                title: "Visible",
                defaultValue: false,
            },
            selectResourceText: {
                type: ControlType.String,
                title: "Select resource",
                defaultValue: "Select resource",
            },
            anyResourceText: {
                type: ControlType.String,
                title: "Any resource",
                defaultValue: "Any resource",
            },
        },
    },
    guestModeTexts: {
        type: ControlType.Object,
        title: "Guest texts",
        hidden: (props) => props.guestMode === false,
        controls: {
            title: {
                type: ControlType.String,
                title: "Title",
                defaultValue: "Client's data",
            },
            subtitle: {
                type: ControlType.String,
                title: "Subtitle",
                defaultValue: "Please fill the form below",
            },
            firstName: {
                type: ControlType.String,
                title: "First Name",
                defaultValue: "First Name",
            },
            lastName: {
                type: ControlType.String,
                title: "Last Name",
                defaultValue: "Last Name",
            },
            email: {
                type: ControlType.String,
                title: "Email",
                defaultValue: "Email",
            },
        },
    },
    customForm: {
        type: ControlType.Object,
        title: "Custom form",
        controls: {
            formTitle: {
                title: "Title",
                type: ControlType.String,
                defaultValue: "Additional data",
            },
            formSubtitle: {
                type: ControlType.String,
                defaultValue: "Please enter fields below",
            },
            fields: {
                type: ControlType.Array,
                control: {
                    type: ControlType.Object,
                    controls: {
                        labelText: {
                            title: "Label",
                            type: ControlType.String,
                            defaultValue: "",
                        },
                        type: {
                            title: "Type",
                            type: ControlType.Enum,
                            defaultValue: "text",
                            options: [
                                "text",
                                "textarea",
                                "number",
                                "multiselect",
                                "select",
                                "phone",
                                "url",
                            ],
                        },
                        options: {
                            title: "Options",
                            type: ControlType.String,
                            defaultValue: "",
                            hidden: (props) =>
                                !["select", "multiselect"].includes(props.type),
                        },
                        placeholderText: {
                            title: "Placeholder",
                            type: ControlType.String,
                            defaultValue: "Enter value",
                        },
                        inputWidth: {
                            type: ControlType.Enum,
                            title: "Input Width",
                            options: ["auto / span 1", "auto / span 2"],
                            optionTitles: ["Half", "Full"],
                            defaultValue: "auto / span 2",
                        },
                        required: {
                            type: ControlType.Boolean,
                            title: "Required",
                            defaultValue: true,
                        },
                        errorText: {
                            title: "Error",
                            type: ControlType.String,
                            defaultValue: "This field is required",
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
        hidden: (props) => props.showTerms === false,
        controls: {
            text: {
                type: ControlType.String,
                title: "Terms text",
                defaultValue: "I agree to the",
            },
            highlightedText: {
                type: ControlType.String,
                title: "Highlighted text",
                defaultValue: "Terms and Conditions",
            },
            termsLink: {
                type: ControlType.String,
                title: "Terms link",
                defaultValue: "https://example.com/terms",
            },
        },
    },
    texts: {
        type: ControlType.Object,
        title: "Texts",
        controls: {
            noTimes: {
                type: ControlType.String,
                title: "No times message",
                defaultValue: "Sorry, but no times are available for this date",
            },
            continue: {
                type: ControlType.String,
                title: "Continue",
                defaultValue: "Continue",
            },
            makeBooking: {
                type: ControlType.String,
                title: "Book",
                defaultValue: "Make booking",
            },
            loginToBook: {
                type: ControlType.String,
                title: "Login button",
                defaultValue: "Please login to book",
            },
            durationText: {
                type: ControlType.String,
                title: "Duration",
                defaultValue: "Duration",
            },
        },
    },
    bkla: {
        type: ControlType.Object,
        title: "Bookla",
        controls: {
            apiRegion: {
                type: ControlType.Enum,
                title: "API region",
                defaultValue: "us",
                options: ["us", "eu"],
                optionTitles: ["U.S.", "Europe"],
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
    selectedDate: {
        type: ControlType.Date,
        title: "Selected date",
    },
    selectedResourceID: {
        type: ControlType.String,
        title: "Resource ID",
        defaultValue: "",
        description:
            "This property can be used to pre-select specific resource.",
    },
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
}

/**
 * @framerDisableUnlink
 */
export default FlexibleBookingComponent
