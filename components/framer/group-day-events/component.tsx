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
import { Minus, Plus } from "lucide-react"
import { BooklaSDK } from "https://esm.sh/@bookla-app/react-client-sdk@0.3.15"
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

interface EventItem {
    date: Date
    timeSlot: TimeSlotWithResource
    serviceName: string
}

interface ClientData {
    id?: string
    email: string
    firstName: string
    lastName: string
}

interface CustomFormField {
    placeholderText: string
    type: "text" | "number" | "multiselect" | "select" | "phone" | "url" | "textarea"
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
    Events,
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

function getRouteId(allRoute, path) {
    for (const [key, value] of Object.entries(allRoute)) {
        if (value?.path === path) {
            return key
        }
    }
    return ""
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

    return timeSlots.sort((a, b) => {
        return (
            new Date(a.timeSlot.startTime).getTime() -
            new Date(b.timeSlot.startTime).getTime()
        )
    })
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

// ParticipantsPicker Component
interface ParticipantsPickerProps {
    title: string
    size: "sm" | "md" | "lg"
    backgroundColor: string
    borderRadius: number
    padding: string
    itemBgColor: string
    itemTextColor: string
    itemSecondaryTextColor: string
    fontFamily: string
    minParticipants: number
    maxParticipants: number
    participants: number
    onParticipantsChange?: (participants: number) => void
}

const ParticipantsPicker: React.FC<ParticipantsPickerProps> = ({
                                                                   title,
                                                                   size,
                                                                   backgroundColor,
                                                                   borderRadius,
                                                                   padding,
                                                                   itemBgColor,
                                                                   itemTextColor,
                                                                   itemSecondaryTextColor,
                                                                   fontFamily,
                                                                   minParticipants = 1,
                                                                   maxParticipants = 10,
                                                                   participants,
                                                                   onParticipantsChange,
                                                               }) => {
    const handleParticipantsChange = (increment: boolean) => {
        const newValue = increment ? participants + 1 : participants - 1
        if (newValue >= minParticipants && newValue <= maxParticipants) {
            onParticipantsChange?.(newValue)
        }
    }

    const canDecrement = participants > minParticipants
    const canIncrement = participants < maxParticipants

    const containerStyle = {
        width: "100%",
        padding: padding,
        backgroundColor: backgroundColor,
        borderRadius: borderRadius,
        border: "1px solid #e5e5e5",
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
        borderRadius: adjustToSize(8, size),
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

    const participantsDisplayStyle = {
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
                        onClick={() => handleParticipantsChange(false)}
                        style={buttonStyle(canDecrement)}
                        disabled={!canDecrement}
                        aria-label="Decrease participants"
                    >
                        <Minus size={16} />
                    </button>
                    <div style={participantsDisplayStyle}>{participants}</div>
                    <button
                        onClick={() => handleParticipantsChange(true)}
                        style={buttonStyle(canIncrement)}
                        disabled={!canIncrement}
                        aria-label="Increase participants"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>
        </div>
    )
}

// EventsList Component
interface EventsListProps {
    size: "sm" | "md" | "lg"
    backgroundColor: string
    borderRadius: number
    padding: string
    itemBgColor: string
    itemSelectColor: string
    itemTextColor: string
    itemSecondaryTextColor: string
    fontFamily: string
    locale: string
    events: EventItem[]
    isLoading: boolean
    selectedEvent: EventItem | null
    onEventSelect: (event: EventItem) => void
    noEventsText: string
}

const EventsList: React.FC<EventsListProps> = ({
                                                   size,
                                                   backgroundColor,
                                                   borderRadius,
                                                   padding,
                                                   itemBgColor,
                                                   itemSelectColor,
                                                   itemTextColor,
                                                   itemSecondaryTextColor,
                                                   fontFamily,
                                                   locale,
                                                   events,
                                                   isLoading,
                                                   selectedEvent,
                                                   onEventSelect,
                                                   noEventsText,
                                               }) => {
    const containerStyle = {
        width: "100%",
        padding: padding,
        backgroundColor: backgroundColor,
        borderRadius: borderRadius,
        border: "1px solid #e5e5e5",
    }

    const loadingContainerStyle = {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "120px",
    }

    const spinnerStyle = {
        width: "40px",
        height: "40px",
        border: "3px solid " + itemTextColor,
        borderTop: "3px solid " + itemSecondaryTextColor,
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
    }

    const eventsListStyle = {
        display: "flex",
        flexDirection: "column" as const,
        gap: adjustToSize(8, size),
    }

    const getEventItemStyle = (isSelected: boolean) => ({
        display: "flex",
        flexDirection: "column" as const,
        padding: adjustToSize(16, size),
        backgroundColor: isSelected ? itemSelectColor : itemBgColor,
        borderRadius: adjustToSize(8, size),
        cursor: "pointer",
        transition: "all 0.2s ease",
        border: "none",
    })

    const serviceTitleStyle = (isSelected: boolean) => ({
        ...headline2,
        fontSize: adjustToSize(16, size),
        color: isSelected ? "white" : itemTextColor,
        marginBottom: adjustToSize(4, size),
        fontFamily: fontFamily !== "" ? fontFamily : null,
    })

    const eventDateStyle = (isSelected: boolean) => ({
        ...body2,
        fontSize: adjustToSize(14, size),
        color: isSelected ? "rgba(255,255,255,0.8)" : itemSecondaryTextColor,
        fontFamily: fontFamily !== "" ? fontFamily : null,
    })

    const noEventsStyle = {
        ...body2,
        fontSize: adjustToSize(16, size),
        color: itemSecondaryTextColor,
        textAlign: "center" as const,
        padding: adjustToSize(40, size),
        fontFamily: fontFamily !== "" ? fontFamily : null,
    }

    const formatEventDate = (date: Date, timeSlot: TimeSlot): string => {
        try {
            const dateStr = new Intl.DateTimeFormat(locale, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
            }).format(date)

            const timeStr = new Intl.DateTimeFormat(locale, {
                hour: "numeric",
                minute: "2-digit",
            }).format(new Date(timeSlot.startTime))

            return `${dateStr} at ${timeStr}`
        } catch {
            return date.toLocaleDateString()
        }
    }

    const isEventSelected = (event: EventItem): boolean => {
        if (!selectedEvent) return false
        return (
            selectedEvent.timeSlot.resourceID === event.timeSlot.resourceID &&
            selectedEvent.timeSlot.timeSlot.startTime === event.timeSlot.timeSlot.startTime
        )
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
            ) : events.length === 0 ? (
                <div style={noEventsStyle}>{noEventsText}</div>
            ) : (
                <div style={eventsListStyle}>
                    {events.map((event, index) => {
                        const isSelected = isEventSelected(event)
                        const key = `${event.timeSlot.resourceID}_${event.timeSlot.timeSlot.startTime}_${index}`

                        return (
                            <button
                                key={key}
                                onClick={() => onEventSelect(event)}
                                style={getEventItemStyle(isSelected)}
                            >
                                <div style={serviceTitleStyle(isSelected)}>
                                    {event.serviceName}
                                </div>
                                <div style={eventDateStyle(isSelected)}>
                                    {formatEventDate(event.date, event.timeSlot.timeSlot)}
                                </div>
                                {event.timeSlot.timeSlot.price && (
                                    <div style={{
                                        ...body2,
                                        fontSize: adjustToSize(14, size),
                                        color: isSelected ? "rgba(255,255,255,0.9)" : itemTextColor,
                                        marginTop: adjustToSize(4, size),
                                        fontWeight: "500",
                                    }}>
                                        {formatPrice(
                                            event.timeSlot.timeSlot.price.amount,
                                            event.timeSlot.timeSlot.price.currency
                                        )}
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
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
        backgroundColor: backgroundColor,
        display: "flex",
        alignItems: "flex-start",
        gap: adjustToSize(12, size),
        padding: adjustToSize(12, size) + ' 0px'
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

// FormView Component
interface FormViewProps {
    size: "sm" | "md" | "lg"
    backgroundColor: string
    primaryColor: string
    secondaryColor: string
    padding: string
    borderRadius: number
    itemBgColor: string
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
    showTerms?: boolean
    terms?: {
        text: string
        highlightedText: string
        termsLink: string
    }
    termsAccepted?: boolean
    onTermsAcceptChange?: (accepted: boolean) => void
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
            borderRadius,
            itemBgColor,
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
            showTerms = false,
            terms,
            termsAccepted = false,
            onTermsAcceptChange,
        },
        ref
    ) => {
        const [formData, setFormData] = useState<{ [key: string]: any }>({})
        const [guestData, setGuestData] = useState<{ [key: string]: any }>({})
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
                onDataChange?.({ ...formData, ...newGuestData })
            } else {
                const newFormData = { ...formData, [key]: value }
                setFormData(newFormData)
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
            padding: padding,
            backgroundColor: backgroundColor,
            borderRadius: borderRadius,
            border: "1px solid #e5e5e5",
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
            fontFamily: fontFamily !== "" ? fontFamily : null,
        }

        const subtitleStyle = {
            ...body1,
            fontSize: adjustToSize(16, size),
            color: secondaryColor,
            marginBottom: 0,
            fontFamily: fontFamily !== "" ? fontFamily : null,
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
                    : "1px solid #e5e5e5",
            borderRadius: adjustToSize(8, size),
            outline: "none",
            opacity: !enabled ? "0.7" : "1",
            backgroundColor:
                focusedInput === inputName ? backgroundColor : itemBgColor,
            transition: "border-color 0.2s ease",
            fontFamily: fontFamily !== "" ? fontFamily : null,
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
                                borderRadius: adjustToSize(8, size),
                                border: "1px solid #e5e5e5",
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
                                        fontFamily: fontFamily !== "" ? fontFamily : null,
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

                {/* Terms and Conditions */}
                {showTerms && terms && (
                    <>
                        <div style={{ marginTop: adjustToSize(20, size) }} />
                        <AcceptTerms
                            padding={padding}
                            size={size}
                            borderRadius={borderRadius}
                            backgroundColor={backgroundColor}
                            itemBgColor={itemBgColor}
                            itemSelectColor={primaryColor}
                            itemTextColor={primaryColor}
                            itemSecondaryTextColor={secondaryColor}
                            fontFamily={fontFamily}
                            text={terms.text}
                            highlightedText={terms.highlightedText}
                            termsLink={terms.termsLink}
                            accepted={termsAccepted}
                            onAcceptChange={onTermsAcceptChange}
                        />
                    </>
                )}
            </div>
        )
    }
)

// ============================================================================
// MAIN EVENT BOOKING COMPONENT
// ============================================================================

interface EventBookingProps {
    // Core settings
    size: "sm" | "md" | "lg"
    backgroundColor: string
    primaryColor: string
    secondaryColor: string
    fontFamily: string
    locale: string
    guestMode: boolean

    // Styling
    item: {
        bgColor: string
        selectColor: string
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
        borderRadius: number
    }

    // Date range settings
    dateRange: {
        months: number
    }

    // Participants settings
    participants: {
        min: number
        max: number
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
        noEvents: string
        continue: string
        makeBooking: string
        loginToBook: string
        participantsText: string
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

function EventBookingComponent(props: EventBookingProps) {
    const { navigate, routes } = useRouter()
    const apiUrl = "https://" + props.bkla.apiRegion + ".bookla.com/api"
    const bookla = useBookla(apiUrl, props.bkla.apiKey)

    // State management
    const [currentStep, setCurrentStep] = useState<BookingStep>(
        BookingStep.Events
    )
    const [loading, setLoading] = useState(false)
    const [submiting, setSubmiting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [serviceLoaded, setServiceLoaded] = useState(false)

    // Service data
    const [serviceName, setServiceName] = useState<string>("")

    // Booking data
    const [events, setEvents] = useState<EventItem[]>([])
    const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)

    // Selection state
    const [currentParticipants, setCurrentParticipants] = useState<number>(
        props.participants.min
    )

    // Form state
    const [clientData, setClientData] = useState<ClientData | null>(null)
    const [formData, setFormData] = useState<{ [key: string]: any }>({})
    const [termsAccepted, setTermsAccepted] = useState<boolean>(false))

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
        if (currentStep === BookingStep.Events && serviceLoaded) {
            loadAvailableEvents()
        }
    }, [currentStep, currentParticipants, serviceLoaded])

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

            setServiceName(response.name || "Event")
            setServiceLoaded(true)
        } catch (err) {
            setError("Failed to load service data: " + err)
            setServiceLoaded(false)
        } finally {
            setLoading(false)
        }
    }

    const loadAvailableEvents = async () => {
        if (
            props.bkla.companyID === "" ||
            props.serviceID === "" ||
            !serviceLoaded
        ) {
            setEvents([])
            return
        }

        setLoading(true)
        setError(null)
        setSelectedEvent(null)

        try {
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            const endDate = new Date(today)
            endDate.setMonth(today.getMonth() + props.dateRange.months)
            endDate.setHours(23, 59, 59, 999)

            const params: any = {
                from: today.toISOString(),
                to: endDate.toISOString(),
                spots: currentParticipants,
            }

            const response = await bookla.services.getTimes(
                props.bkla.companyID,
                props.serviceID,
                params
            )

            const slots = formatSlots(response)

            // Group by date and take first slot for each date
            const eventsByDate = new Map<string, EventItem>()

            slots.forEach(slot => {
                const date = new Date(slot.timeSlot.startTime)
                date.setHours(0, 0, 0, 0)
                const dateKey = date.toISOString().split('T')[0]

                if (!eventsByDate.has(dateKey)) {
                    eventsByDate.set(dateKey, {
                        date,
                        timeSlot: slot,
                        serviceName,
                    })
                }
            })

            const eventsList = Array.from(eventsByDate.values()).sort((a, b) =>
                a.date.getTime() - b.date.getTime()
            )

            setEvents(eventsList)
        } catch (err) {
            setError("Failed to load events: " + err)
        } finally {
            setLoading(false)
        }
    }

    const makeBooking = async () => {
        if (!selectedEvent) {
            return
        }

        setSubmiting(true)
        setError(null)

        try {
            let data: any = {
                companyID: props.bkla.companyID,
                serviceID: props.serviceID,
                resourceID: selectedEvent.timeSlot.resourceID,
                startTime: new Date(
                    selectedEvent.timeSlot.timeSlot.startTime
                ).toISOString(),
                spots: currentParticipants,
            }

            if (Object.keys(formData).length > 0) {
                data.metaData = formData
            }

            if (props.guestMode && clientData) {
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
        if (currentStep === BookingStep.Events) {
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
            setCurrentStep(BookingStep.Events)
            return
        }
    }

    // ============================================================================
    // RENDER HELPERS
    // ============================================================================

    const getButtonTitle = () => {
        if (
            currentStep === BookingStep.Events &&
            (props.guestMode || props.customForm.fields?.length > 0)
        ) {
            return props.texts.continue
        }
        return props.texts.makeBooking
    }

    const bookButtonEnabled =
        !submiting &&
        (isAuthorized || props.guestMode) &&
        (currentStep !== BookingStep.Events || selectedEvent !== null) &&
        (!props.showTerms || !props.guestMode || currentStep !== BookingStep.Form || termsAccepted)

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
        position: "relative" as const,
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
                    borderRadius={props.blocks.borderRadius}
                    itemTextColor={props.primaryColor}
                    itemBgColor={props.item.bgColor}
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
                    showTerms={props.showTerms}
                    terms={props.terms}
                    termsAccepted={termsAccepted}
                    onTermsAcceptChange={setTermsAccepted}
                />
            )}

            {/* Events Selection Step */}
            {currentStep === BookingStep.Events && (
                <>
                    {/* Participants Picker */}
                    <ParticipantsPicker
                        size={props.size}
                        title={props.texts.participantsText}
                        padding={props.blocks.padding}
                        backgroundColor={props.backgroundColor}
                        borderRadius={props.blocks.borderRadius}
                        itemBgColor={props.item.bgColor}
                        fontFamily={props.fontFamily}
                        itemTextColor={props.primaryColor}
                        itemSecondaryTextColor={props.secondaryColor}
                        minParticipants={props.participants.min}
                        maxParticipants={props.participants.max}
                        participants={currentParticipants}
                        onParticipantsChange={setCurrentParticipants}
                    />

                    <div
                        style={{
                            padding: adjustToSize(props.blocks.gap, props.size),
                        }}
                    />

                    {/* Events List */}
                    <EventsList
                        size={props.size}
                        backgroundColor={props.backgroundColor}
                        borderRadius={props.blocks.borderRadius}
                        padding={props.blocks.padding}
                        itemBgColor={props.item.bgColor}
                        itemSelectColor={props.item.selectColor}
                        itemTextColor={props.primaryColor}
                        itemSecondaryTextColor={props.secondaryColor}
                        fontFamily={props.fontFamily}
                        locale={props.locale}
                        events={events}
                        isLoading={loading}
                        selectedEvent={selectedEvent}
                        onEventSelect={setSelectedEvent}
                        noEventsText={props.texts.noEvents}
                    />
                </>
            )}

            <div
                style={{ padding: adjustToSize(props.blocks.gap, props.size) }}
            />

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
                            style={spinnerStyle(props.button.textColor)}
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

EventBookingComponent.propertyControls = {
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
            borderRadius: {
                type: ControlType.BorderRadius,
                title: "Border Radius",
                defaultValue: "16px",
                step: 1,
            },
        },
    },
    dateRange: {
        type: ControlType.Object,
        title: "Date range",
        controls: {
            months: {
                type: ControlType.Number,
                title: "Months ahead",
                defaultValue: 2,
                min: 1,
                max: 12,
                step: 1,
            },
        },
    },
    participants: {
        type: ControlType.Object,
        title: "Participants",
        controls: {
            min: {
                type: ControlType.Number,
                title: "Min Participants",
                defaultValue: 1,
                min: 1,
                step: 1,
            },
            max: {
                type: ControlType.Number,
                title: "Max Participants",
                defaultValue: 10,
                min: 1,
                step: 1,
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
            noEvents: {
                type: ControlType.String,
                title: "No events message",
                defaultValue: "No events available in the selected period",
            },
            continue: {
                type: ControlType.String,
                title: "Continue",
                defaultValue: "Continue",
            },
            makeBooking: {
                type: ControlType.String,
                title: "Book",
                defaultValue: "Book Event",
            },
            loginToBook: {
                type: ControlType.String,
                title: "Login button",
                defaultValue: "Please login to book",
            },
            participantsText: {
                type: ControlType.String,
                title: "Participants",
                defaultValue: "Number of Participants",
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
export default EventBookingComponent