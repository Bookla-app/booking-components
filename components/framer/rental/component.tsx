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
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react"
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
    DateRange,
    Form,
    Success,
    Pending,
    Error,
}

interface DateRange {
    startDate: Date | null
    endDate: Date | null
    startTime: string
    endTime: string
}

// ============================================================================
// UTILITY FUNCTIONS
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

const convertToUTC = (localDate: Date, timeZone: string): Date => {
    // Get the timezone offset for this specific date (handles DST automatically)
    // We need to create a date that represents the same local time in the target timezone

    const year = localDate.getFullYear()
    const month = localDate.getMonth()
    const day = localDate.getDate()
    const hours = localDate.getHours()
    const minutes = localDate.getMinutes()
    const seconds = localDate.getSeconds()
    const ms = localDate.getMilliseconds()

    // Create a test date to get the timezone offset for this time of year
    const testDate = new Date(year, month, day, 12, 0, 0) // Use noon to avoid DST edge cases

    // Calculate how much the target timezone is offset from UTC
    const utcTime = new Date(
        testDate.toLocaleString("en-US", { timeZone: "UTC" })
    )
    const tzTime = new Date(testDate.toLocaleString("en-US", { timeZone }))
    const offsetMs = utcTime.getTime() - tzTime.getTime()

    // Create UTC date by treating the local date as if it were in the target timezone
    const targetTime = new Date(
        Date.UTC(year, month, day, hours, minutes, seconds, ms)
    )
    return new Date(targetTime.getTime() + offsetMs)
}

const getTimezoneOffsetString = (timeZone: string, date: Date): string => {
    // Get the timezone offset for a specific date and timezone
    const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }))
    const localDate = new Date(date.toLocaleString("en-US", { timeZone }))
    const offsetMinutes =
        (localDate.getTime() - utcDate.getTime()) / (1000 * 60)

    const hours = Math.floor(Math.abs(offsetMinutes) / 60)
    const minutes = Math.abs(offsetMinutes) % 60
    const sign = offsetMinutes >= 0 ? "+" : "-"

    return `${sign}${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

const getTimezoneOffset = (timeZone: string, date: Date): number => {
    // Get the timezone offset in minutes (like getTimezoneOffset() but for any timezone)
    // Positive values are behind UTC, negative values are ahead of UTC
    const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }))
    const tzDate = new Date(date.toLocaleString("en-US", { timeZone }))
    return (utcDate.getTime() - tzDate.getTime()) / (1000 * 60)
}

const durationToISO = (duration: Duration): string => {
    return `PT${duration.days * 24 + duration.hours}H${duration.minutes}M`
}

const calculateDuration = (
    startDateTime: Date,
    endDateTime: Date
): Duration => {
    const diffMs = endDateTime.getTime() - startDateTime.getTime()
    const totalMinutes = Math.floor(diffMs / (1000 * 60))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const days = Math.floor(hours / 24)

    return {
        days,
        hours: hours % 24,
        minutes,
    }
}

const generateTimeOptions = (): string[] => {
    const times = []
    for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, "0")
        times.push(`${hour}:00`)
    }
    return times
}

function getRouteId(allRoute, path) {
    for (const [key, value] of Object.entries(allRoute)) {
        if (value?.path === path) {
            return key
        }
    }
    return ""
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// DateRangePicker Component
interface DateRangePickerProps {
    size: "sm" | "md" | "lg"
    primaryColor: string
    secondaryColor: string
    backgroundColor: string
    accentColor: string
    selectedColor: string
    disabledColor: string
    borderRadius: number
    padding: number
    fontFamily: string
    locale: string
    dateRange: DateRange
    onDateRangeChange: (dateRange: DateRange) => void
    availableDates: string[]
    onMonthChange: (year: number, month: number) => void
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
                                                             size,
                                                             primaryColor,
                                                             secondaryColor,
                                                             backgroundColor,
                                                             accentColor,
                                                             selectedColor,
                                                             disabledColor,
                                                             borderRadius,
                                                             padding,
                                                             fontFamily,
                                                             locale,
                                                             dateRange,
                                                             onDateRangeChange,
                                                             availableDates,
                                                             onMonthChange,
                                                         }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectionMode, setSelectionMode] = useState<"start" | "end">("start")

    const timeOptions = generateTimeOptions()

    useEffect(() => {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth()
        onMonthChange(year, month)
    }, [currentMonth]) // Removed onMonthChange from dependencies

    const isDateAvailable = (date: Date) => {
        // Format date as YYYY-MM-DD in local time to match API response format
        const year = date.getFullYear()
        const month = (date.getMonth() + 1).toString().padStart(2, "0")
        const day = date.getDate().toString().padStart(2, "0")
        const dateStr = `${year}-${month}-${day}`
        return availableDates.includes(dateStr)
    }

    const isDateInRange = (date: Date) => {
        if (!dateRange.startDate || !dateRange.endDate) return false

        // Normalize all dates to midnight for proper comparison
        const targetDate = new Date(date)
        targetDate.setHours(0, 0, 0, 0)

        const startDate = new Date(dateRange.startDate)
        startDate.setHours(0, 0, 0, 0)

        const endDate = new Date(dateRange.endDate)
        endDate.setHours(0, 0, 0, 0)

        return (
            targetDate.getTime() >= startDate.getTime() &&
            targetDate.getTime() <= endDate.getTime()
        )
    }

    const isDateSelected = (date: Date) => {
        if (!dateRange.startDate && !dateRange.endDate) return false

        // Normalize all dates to midnight for proper comparison
        const targetDate = new Date(date)
        targetDate.setHours(0, 0, 0, 0)

        const startTime = dateRange.startDate
            ? new Date(dateRange.startDate).setHours(0, 0, 0, 0)
            : null
        const endTime = dateRange.endDate
            ? new Date(dateRange.endDate).setHours(0, 0, 0, 0)
            : null

        const targetTime = targetDate.getTime()
        return targetTime === startTime || targetTime === endTime
    }

    const handleDateClick = (date: Date) => {
        if (!isDateAvailable(date)) return

        if (selectionMode === "start" || !dateRange.startDate) {
            onDateRangeChange({
                ...dateRange,
                startDate: date,
                endDate: null,
            })
            setSelectionMode("end")
        } else {
            if (date < dateRange.startDate) {
                // If clicking before start date, make it the new start
                onDateRangeChange({
                    ...dateRange,
                    startDate: date,
                    endDate: null,
                })
                setSelectionMode("end")
            } else {
                // Set as end date
                onDateRangeChange({
                    ...dateRange,
                    endDate: date,
                })
                setSelectionMode("start")
            }
        }
    }

    const handleTimeChange = (type: "start" | "end", time: string) => {
        onDateRangeChange({
            ...dateRange,
            [type + "Time"]: time,
        })
    }

    const getDaysInMonth = () => {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const daysInMonth = lastDay.getDate()
        const startDate = new Date(firstDay)
        startDate.setDate(startDate.getDate() - firstDay.getDay())

        const days = []
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate)
            date.setDate(startDate.getDate() + i)
            days.push(date)
        }
        return days
    }

    const navigateMonth = (direction: number) => {
        const newMonth = new Date(currentMonth)
        newMonth.setMonth(currentMonth.getMonth() + direction)
        setCurrentMonth(newMonth)
    }

    const containerStyle = {
        backgroundColor,
        borderRadius: `${borderRadius}px`,
        padding: `${padding}px`,
        fontFamily: fontFamily || "inherit",
        width: "100%",
    }

    const headerStyle = {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: adjustToSize(20, size),
        padding: `0 ${adjustToSize(8, size)}`,
    }

    const monthTitleStyle = {
        fontSize: adjustToSize(18, size),
        fontWeight: "600",
        color: primaryColor,
        margin: 0,
    }

    const navButtonStyle = {
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: adjustToSize(8, size),
        borderRadius: `${borderRadius / 2}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: secondaryColor,
        transition: "background-color 0.2s ease",
    }

    const weekdaysStyle = {
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: adjustToSize(4, size),
        marginBottom: adjustToSize(8, size),
    }

    const weekdayStyle = {
        textAlign: "center" as const,
        fontSize: adjustToSize(12, size),
        fontWeight: "500",
        color: secondaryColor,
        padding: adjustToSize(8, size),
    }

    const calendarGridStyle = {
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: adjustToSize(4, size),
        marginBottom: adjustToSize(20, size),
    }

    const getDayButtonStyle = (date: Date) => {
        const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
        const isToday = date.toDateString() === new Date().toDateString()
        const isAvailable = isDateAvailable(date) && isCurrentMonth
        const isSelected = isDateSelected(date)
        const isInRange = isDateInRange(date)

        return {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: adjustToSize(40, size),
            border: "none",
            borderRadius: `${borderRadius / 2}px`,
            cursor: isAvailable ? "pointer" : "not-allowed",
            fontSize: adjustToSize(14, size),
            fontWeight: isSelected ? "600" : "400",
            color: !isCurrentMonth
                ? disabledColor
                : isSelected || isInRange
                    ? "#fff"
                    : !isAvailable
                        ? disabledColor
                        : isToday
                            ? accentColor
                            : primaryColor,
            backgroundColor:
                isSelected || isInRange
                    ? selectedColor
                    : isToday && !isSelected && !isInRange
                        ? `${accentColor}20`
                        : "transparent",
            opacity: !isCurrentMonth ? 0.3 : 1,
            transition: "all 0.2s ease",
        }
    }

    const timePickerContainerStyle = {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: adjustToSize(16, size),
        marginTop: adjustToSize(16, size),
    }

    const timePickerBlockStyle = {
        display: "flex",
        alignItems: "center",
        gap: adjustToSize(8, size),
        padding: adjustToSize(12, size),
        backgroundColor: "#f8f9fa", // light background
        borderRadius: adjustToSize(12, size),
        border: "1px solid #d1d5db",
        fontSize: adjustToSize(14, size),
        color: "#111827", // dark text
        cursor: "pointer",
    }

    const timeSelectStyle = {
        //appearance: "none" as const,
        backgroundColor: "transparent",
        border: "none",
        fontSize: adjustToSize(18, size),
        color: "#111827",
        cursor: "pointer",
        flex: 1,
        outline: "none",
    }

    const clockIconStyle = {
        flexShrink: 0,
        paddingTop: "3px",
    }

    const timePickerStyle = {
        display: "flex",
        flexDirection: "column" as const,
        gap: adjustToSize(8, size),
    }

    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const days = getDaysInMonth()

    return (
        <div style={containerStyle}>
            {/* Calendar Header */}
            <div style={headerStyle}>
                <button
                    style={navButtonStyle}
                    onClick={() => navigateMonth(-1)}
                >
                    <ChevronLeft size={adjustToSizeNum(20, size)} />
                </button>

                <h3 style={monthTitleStyle}>
                    {currentMonth.toLocaleDateString(locale, {
                        month: "long",
                        year: "numeric",
                    })}
                </h3>

                <button style={navButtonStyle} onClick={() => navigateMonth(1)}>
                    <ChevronRight size={adjustToSizeNum(20, size)} />
                </button>
            </div>

            {/* Weekday Headers */}
            <div style={weekdaysStyle}>
                {weekdays.map((day) => (
                    <div key={day} style={weekdayStyle}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div style={calendarGridStyle}>
                {days.map((date, index) => (
                    <button
                        key={index}
                        style={getDayButtonStyle(date)}
                        onClick={() => handleDateClick(date)}
                        disabled={
                            !isDateAvailable(date) ||
                            date.getMonth() !== currentMonth.getMonth()
                        }
                    >
                        {date.getDate()}
                    </button>
                ))}
            </div>

            {/* Time Pickers */}
            <div style={timePickerContainerStyle}>
                <div style={timePickerStyle}>
                    <label
                        style={{
                            fontSize: adjustToSize(16, size),
                            color: "#6b7280",
                        }}
                    >
                        Start time
                    </label>
                    <div style={timePickerBlockStyle}>
                        <span style={clockIconStyle}>
                            <Clock size={adjustToSizeNum(16, size)} />
                        </span>
                        <select
                            style={timeSelectStyle}
                            value={dateRange.startTime}
                            onChange={(e) =>
                                handleTimeChange("start", e.target.value)
                            }
                        >
                            {timeOptions.map((time) => (
                                <option key={time} value={time}>
                                    {time}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={timePickerStyle}>
                    <label
                        style={{
                            fontSize: adjustToSize(16, size),
                            color: "#6b7280",
                        }}
                    >
                        End time
                    </label>
                    <div style={timePickerBlockStyle}>
                        <span style={clockIconStyle}>
                            <Clock size={adjustToSizeNum(16, size)} />
                        </span>
                        <select
                            style={timeSelectStyle}
                            value={dateRange.endTime}
                            onChange={(e) =>
                                handleTimeChange("end", e.target.value)
                            }
                        >
                            {timeOptions.map((time) => (
                                <option key={time} value={time}>
                                    {time}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    )
}

// FormView Component (reused from existing)
interface FormViewProps {
    size: "sm" | "md" | "lg"
    primaryColor: string
    secondaryColor: string
    backgroundColor: string
    borderRadius: number
    padding: number
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
            primaryColor,
            secondaryColor,
            backgroundColor,
            borderRadius,
            padding,
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
        const [guestData, setGuestData] = useState<{ [key: string]: any }>({})
        const [formErrors, setFormErrors] = useState<{ [key: string]: string }>(
            {}
        )
        const [focusedInput, setFocusedInput] = useState<string | null>(null)

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
                onDataChange?.({ ...formData, ...newGuestData })
            } else {
                const newFormData = { ...formData, [key]: value }
                setFormData(newFormData)
                onDataChange?.({ ...newFormData, ...guestData })
            }
        }

        const getFieldValue = (field: CustomFormField) => {
            const isGuestField = ["firstName", "lastName", "email"].includes(
                field.labelText
            )
            return isGuestField
                ? guestData[field.labelText] || ""
                : formData[field.labelText] || ""
        }

        const containerStyle = {
            backgroundColor,
            borderRadius: `${borderRadius}px`,
            padding: `${padding}px`,
            fontFamily: fontFamily || "inherit",
            width: "100%",
        }

        const headerStyle = {
            marginBottom: adjustToSize(20, size),
        }

        const backButtonStyle = {
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: adjustToSize(8, size),
            display: "flex",
            alignItems: "center",
            color: secondaryColor,
            marginBottom: adjustToSize(8, size),
        }

        const titleStyle = {
            fontSize: adjustToSize(18, size),
            fontWeight: "600",
            color: primaryColor,
            margin: `0 0 ${adjustToSize(8, size)} 0`,
        }

        const subtitleStyle = {
            fontSize: adjustToSize(14, size),
            color: secondaryColor,
            margin: 0,
        }

        const formGridStyle = {
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: adjustToSize(16, size),
        }

        const getInputStyle = (inputName: string) => ({
            width: "100%",
            color: primaryColor,
            padding: adjustToSize(12, size),
            fontSize: adjustToSize(16, size),
            border:
                focusedInput === inputName
                    ? `1px solid ${primaryColor}`
                    : "1px solid #e5e5e5",
            borderRadius: `${borderRadius / 2}px`,
            outline: "none",
            opacity: !enabled ? "0.7" : "1",
            backgroundColor: "#fff",
            transition: "border-color 0.2s ease",
        })

        const labelStyle = {
            display: "block",
            marginBottom: adjustToSize(4, size),
            color: secondaryColor,
            fontSize: adjustToSize(14, size),
            fontWeight: "500",
        }

        const errorMessageStyle = {
            color: "#dc2626",
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
                                backgroundColor: "#f9f9f9",
                                borderRadius: `${borderRadius / 2}px`,
                            }}
                        >
                            {options.map((opt) => (
                                <label
                                    key={opt}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: adjustToSize(8, size),
                                        color: primaryColor,
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
                <div style={headerStyle}>
                    {onBack && (
                        <button onClick={onBack} style={backButtonStyle}>
                            <ChevronLeft size={adjustToSizeNum(16, size)} />
                            Back
                        </button>
                    )}
                    <h2 style={titleStyle}>{title}</h2>
                    <p style={subtitleStyle}>{subtitle}</p>
                </div>

                {error && (
                    <div
                        style={{
                            padding: adjustToSize(12, size),
                            marginBottom: adjustToSize(16, size),
                            backgroundColor: "#fee2e2",
                            color: "#dc2626",
                            borderRadius: `${borderRadius / 2}px`,
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

// ============================================================================
// MAIN DATE RANGE BOOKING COMPONENT
// ============================================================================

interface DateRangeBookingProps {
    // Simplified styling
    size: "sm" | "md" | "lg"
    primaryColor: string
    secondaryColor: string
    backgroundColor: string
    accentColor: string
    selectedColor: string
    disabledColor: string
    fontFamily: string
    locale: string
    borderRadius: number
    padding: number

    // Button styling
    buttonBg: string
    buttonText: string

    // Layout
    gap: number

    // Guest mode
    guestMode: boolean

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

    // Texts
    texts: {
        continue: string
        makeBooking: string
        loginToBook: string
        datesUnavailable: string
    }

    // API settings
    bkla: {
        apiRegion: "us" | "eu"
        apiKey: string
        companyID: string
    }
    serviceID: string
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

function DateRangeBookingComponent(props: DateRangeBookingProps) {
    const { navigate, routes } = useRouter()
    const apiUrl = "https://" + props.bkla.apiRegion + ".bookla.com/api"
    const bookla = useBookla(apiUrl, props.bkla.apiKey)

    // State management
    const [currentStep, setCurrentStep] = useState<BookingStep>(
        BookingStep.DateRange
    )
    const [loading, setLoading] = useState(false)
    const [submiting, setSubmiting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [serviceLoaded, setServiceLoaded] = useState(false)

    // Date range state
    const [dateRange, setDateRange] = useState<DateRange>({
        startDate: null,
        endDate: null,
        startTime: "09:00",
        endTime: "09:00",
    })

    // Availability state
    const [availableDates, setAvailableDates] = useState<string[]>([])
    const [selectedSlot, setSelectedSlot] =
        useState<TimeSlotWithResource | null>(null)
    const [serviceTimezone, setServiceTimezone] = useState<string>("")

    // Form state
    const [clientData, setClientData] = useState<ClientData | null>(null)
    const [formData, setFormData] = useState<{ [key: string]: any }>({})

    // Refs
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
        setServiceLoaded(false)
        loadServiceData()
    }, [props.clientTokens])

    useEffect(() => {
        if (currentStep === BookingStep.Success) {
            proceedToRoute(props.routes.confirmed)
        } else if (currentStep === BookingStep.Pending) {
            proceedToRoute(props.routes.pending)
        }
    }, [currentStep])

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

            // Set service timezone for all date/time calculations
            if (response.timeZone) {
                setServiceTimezone(response.timeZone)
            } else {
                // Fallback to local timezone if service doesn't specify one
                setServiceTimezone(
                    Intl.DateTimeFormat().resolvedOptions().timeZone
                )
            }

            setServiceLoaded(true)
        } catch (err) {
            setError("Failed to load service data: " + err)
            setServiceLoaded(false)
        } finally {
            setLoading(false)
        }
    }

    const fetchAvailableDates = useCallback(
        async (year: number, month: number) => {
            if (
                props.bkla.companyID === "" ||
                props.serviceID === "" ||
                !serviceLoaded ||
                !serviceTimezone
            ) {
                setAvailableDates([])
                return
            }

            try {
                // Use service timezone for date calculations
                const startOfMonth = new Date(year, month, 1)
                const endOfMonth = new Date(year, month + 1, 0)
                endOfMonth.setHours(23, 59, 59, 999)

                // Convert service timezone times to UTC
                const startUTC = convertToUTC(startOfMonth, serviceTimezone)
                const endUTC = convertToUTC(endOfMonth, serviceTimezone)

                // Use 23h duration to check availability
                const params = {
                    from: startUTC.toISOString(),
                    to: endUTC.toISOString(),
                    duration: "PT23H",
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
        },
        [
            props.bkla.companyID,
            props.serviceID,
            serviceLoaded,
            serviceTimezone,
            bookla,
        ]
    )

    const checkSlotAvailability = useCallback(async () => {
        if (
            !dateRange.startDate ||
            !dateRange.endDate ||
            props.bkla.companyID === "" ||
            props.serviceID === "" ||
            !serviceLoaded ||
            !serviceTimezone
        ) {
            setSelectedSlot(null)
            return
        }

        // Use service timezone for all calculations
        const startDateTime = new Date(dateRange.startDate)
        const [startHour, startMinute] = dateRange.startTime
            .split(":")
            .map(Number)
        startDateTime.setHours(startHour, startMinute, 0, 0)

        const endDateTime = new Date(dateRange.endDate)
        const [endHour, endMinute] = dateRange.endTime.split(":").map(Number)
        endDateTime.setHours(endHour, endMinute, 0, 0)

        // Check minimum 24h duration
        const duration = calculateDuration(startDateTime, endDateTime)
        const totalHours =
            duration.days * 24 + duration.hours + duration.minutes / 60

        if (totalHours < 24) {
            setSelectedSlot(null)
            return
        }

        try {
            // Convert service timezone times to UTC
            const startUTC = convertToUTC(startDateTime, serviceTimezone)
            const endUTC = convertToUTC(endDateTime, serviceTimezone)

            const params = {
                from: startUTC.toISOString(),
                to: endUTC.toISOString(),
                duration: durationToISO(duration),
            }

            const response = await bookla.services.getTimes(
                props.bkla.companyID,
                props.serviceID,
                params
            )

            // Get the first available slot that matches our start time
            const times = response["times"]
            const resourceIDs = Object.keys(times)

            for (const resourceID of resourceIDs) {
                const slots = times[resourceID]
                for (const slot of slots) {
                    const slotStart = new Date(slot.startTime)
                    if (
                        Math.abs(
                            slotStart.getTime() - startDateTime.getTime()
                        ) < 60000
                    ) {
                        // Within 1 minute
                        setSelectedSlot({
                            timeSlot: slot,
                            resourceID: resourceID,
                        })
                        return
                    }
                }
            }

            setSelectedSlot(null)
        } catch (err) {
            console.error("Failed to check slot availability:", err)
            setSelectedSlot(null)
        }
    }, [
        dateRange.startDate,
        dateRange.endDate,
        dateRange.startTime,
        dateRange.endTime,
        props.bkla.companyID,
        props.serviceID,
        serviceLoaded,
        serviceTimezone,
        bookla,
    ])

    const makeBooking = async () => {
        if (
            !selectedSlot ||
            !dateRange.startDate ||
            !dateRange.endDate ||
            !serviceTimezone
        ) {
            return
        }

        setSubmiting(true)
        setError(null)

        try {
            // Use service timezone for booking creation
            const startDateTime = new Date(dateRange.startDate)
            const [startHour, startMinute] = dateRange.startTime
                .split(":")
                .map(Number)
            startDateTime.setHours(startHour, startMinute, 0, 0)

            const endDateTime = new Date(dateRange.endDate)
            const [endHour, endMinute] = dateRange.endTime
                .split(":")
                .map(Number)
            endDateTime.setHours(endHour, endMinute, 0, 0)

            const duration = calculateDuration(startDateTime, endDateTime)

            // Convert service timezone time to UTC
            const startUTC = convertToUTC(startDateTime, serviceTimezone)

            let data: any = {
                companyID: props.bkla.companyID,
                serviceID: props.serviceID,
                resourceID: selectedSlot.resourceID,
                startTime: startUTC.toISOString(),
                duration: durationToISO(duration),
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
        if (currentStep === BookingStep.DateRange) {
            if (props.guestMode || props.customForm.fields?.length > 0) {
                setCurrentStep(BookingStep.Form)
                return
            }
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
            setCurrentStep(BookingStep.DateRange)
            return
        }
    }

    // Check if dates are valid and slot is available
    const isDurationValid = useCallback(() => {
        if (!dateRange.startDate || !dateRange.endDate) return false

        const startDateTime = new Date(dateRange.startDate)
        const [startHour, startMinute] = dateRange.startTime
            .split(":")
            .map(Number)
        startDateTime.setHours(startHour, startMinute, 0, 0)

        const endDateTime = new Date(dateRange.endDate)
        const [endHour, endMinute] = dateRange.endTime.split(":").map(Number)
        endDateTime.setHours(endHour, endMinute, 0, 0)

        const duration = calculateDuration(startDateTime, endDateTime)
        const totalHours =
            duration.days * 24 + duration.hours + duration.minutes / 60

        return totalHours >= 24
    }, [
        dateRange.startDate,
        dateRange.endDate,
        dateRange.startTime,
        dateRange.endTime,
    ])

    // Effect to check slot availability when date range changes
    useEffect(() => {
        if (isDurationValid()) {
            checkSlotAvailability()
        } else {
            setSelectedSlot(null)
        }
    }, [checkSlotAvailability, isDurationValid])

    // ============================================================================
    // RENDER HELPERS
    // ============================================================================

    const getButtonTitle = () => {
        if (currentStep === BookingStep.DateRange) {
            if (!isDurationValid()) {
                return "Please select valid dates (minimum 24h)"
            }
            if (!selectedSlot) {
                return props.texts.datesUnavailable
            }

            // Show price if available
            const baseText =
                props.guestMode || props.customForm.fields?.length > 0
                    ? props.texts.continue
                    : props.texts.makeBooking

            if (selectedSlot?.timeSlot?.price) {
                const priceText = formatPrice(
                    selectedSlot.timeSlot.price.amount,
                    selectedSlot.timeSlot.price.currency
                )
                return `${baseText} - ${priceText}`
            }

            return baseText
        }
        return props.texts.makeBooking
    }

    const isButtonEnabled = () => {
        if (submiting) return false
        if (currentStep === BookingStep.DateRange) {
            return (
                isDurationValid() &&
                selectedSlot !== null &&
                (isAuthorized || props.guestMode)
            )
        }
        return isAuthorized || props.guestMode
    }

    const containerStyle = {
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column" as const,
        gap: `${props.gap}px`,
        fontFamily: props.fontFamily || "inherit",
    }

    const buttonStyle = {
        width: "100%",
        border: "none",
        padding: adjustToSize(16, props.size),
        backgroundColor: props.buttonBg,
        color: props.buttonText,
        fontSize: adjustToSize(16, props.size),
        fontWeight: "600",
        borderRadius: `${props.borderRadius}px`,
        opacity: isButtonEnabled() ? 1 : 0.5,
        cursor: isButtonEnabled() ? "pointer" : "not-allowed",
        transition: "opacity 0.2s ease",
    }

    // ============================================================================
    // MAIN RENDER
    // ============================================================================

    if (!serviceLoaded && loading) {
        return (
            <div style={containerStyle}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: `${props.padding}px`,
                        color: props.secondaryColor,
                        fontSize: adjustToSize(16, props.size),
                    }}
                >
                    Loading service configuration...
                </div>
            </div>
        )
    }

    if (!serviceLoaded && error) {
        return (
            <div style={containerStyle}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: `${props.padding}px`,
                        color: "#dc2626",
                        fontSize: adjustToSize(16, props.size),
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
            {currentStep === BookingStep.DateRange && (
                <DateRangePicker
                    size={props.size}
                    primaryColor={props.primaryColor}
                    secondaryColor={props.secondaryColor}
                    backgroundColor={props.backgroundColor}
                    accentColor={props.accentColor}
                    selectedColor={props.selectedColor}
                    disabledColor={props.disabledColor}
                    borderRadius={props.borderRadius}
                    padding={props.padding}
                    fontFamily={props.fontFamily}
                    locale={props.locale}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    availableDates={availableDates}
                    onMonthChange={fetchAvailableDates}
                />
            )}

            {currentStep === BookingStep.Form && (
                <FormView
                    ref={formRef}
                    size={props.size}
                    primaryColor={props.primaryColor}
                    secondaryColor={props.secondaryColor}
                    backgroundColor={props.backgroundColor}
                    borderRadius={props.borderRadius}
                    padding={props.padding}
                    fontFamily={props.fontFamily}
                    enabled={!submiting}
                    onDataChange={handleFormDataChange}
                    error={error}
                    fields={props.customForm.fields}
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

            {/* Action Button */}
            {isAuthorized || props.guestMode ? (
                <button
                    style={buttonStyle}
                    disabled={!isButtonEnabled()}
                    onClick={proceedToNextStep}
                >
                    {getButtonTitle()}
                </button>
            ) : (
                <button
                    style={buttonStyle}
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

DateRangeBookingComponent.propertyControls = {
    size: {
        type: ControlType.Enum,
        title: "Size",
        defaultValue: "md",
        options: ["sm", "md", "lg"],
        optionTitles: ["Small", "Medium", "Large"],
    },
    primaryColor: {
        type: ControlType.Color,
        title: "Primary Color",
        defaultValue: "#000000",
    },
    secondaryColor: {
        type: ControlType.Color,
        title: "Secondary Color",
        defaultValue: "#666666",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background Color",
        defaultValue: "#ffffff",
    },
    accentColor: {
        type: ControlType.Color,
        title: "Accent Color",
        defaultValue: "#3b82f6",
    },
    selectedColor: {
        type: ControlType.Color,
        title: "Selected Color",
        defaultValue: "#10b981",
    },
    disabledColor: {
        type: ControlType.Color,
        title: "Disabled Color",
        defaultValue: "#d1d5db",
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
    borderRadius: {
        type: ControlType.Number,
        title: "Border Radius",
        defaultValue: 8,
        step: 1,
    },
    padding: {
        type: ControlType.Number,
        title: "Padding",
        defaultValue: 20,
        step: 2,
    },
    buttonBg: {
        type: ControlType.Color,
        title: "Button Background",
        defaultValue: "#10b981",
    },
    buttonText: {
        type: ControlType.Color,
        title: "Button Text",
        defaultValue: "#ffffff",
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 16,
        step: 2,
    },
    guestMode: {
        type: ControlType.Boolean,
        title: "Guest Mode",
        defaultValue: true,
    },
    guestModeTexts: {
        type: ControlType.Object,
        title: "Guest Texts",
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
        title: "Custom Form",
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
    texts: {
        type: ControlType.Object,
        title: "Texts",
        controls: {
            continue: {
                type: ControlType.String,
                title: "Continue",
                defaultValue: "Continue",
            },
            makeBooking: {
                type: ControlType.String,
                title: "Make Booking",
                defaultValue: "Make booking",
            },
            loginToBook: {
                type: ControlType.String,
                title: "Login Button",
                defaultValue: "Please login to book",
            },
            datesUnavailable: {
                type: ControlType.String,
                title: "Dates Unavailable",
                defaultValue: "These dates are unavailable",
            },
        },
    },
    bkla: {
        type: ControlType.Object,
        title: "Bookla",
        controls: {
            apiRegion: {
                type: ControlType.Enum,
                title: "API Region",
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
export default DateRangeBookingComponent
