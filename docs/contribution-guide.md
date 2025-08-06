# Contributing to Bookla Components

Thank you for contributing! Here's how to submit your component.

## Component Requirements

### 📋 Checklist
- [ ] Component works with Bookla API
- [ ] Includes complete documentation
- [ ] Has visual preview image
- [ ] Responsive design
- [ ] Accessible (screen reader friendly)
- [ ] Self-contained (all files included)

### 📁 File Structure
```plaintext
components/[platform]/[component-name]/
├── README.md           # Usage documentation
├── [component-files]   # Main component code
├── preview.jpg         # 1200x800px screenshot
└── dependencies.txt    # Required packages (if any)
```

### 📝 Documentation Requirements
- Clear installation/usage instructions
- Props/configuration table
- Customization examples
- Bookla API integration details
- Preview image showing the component

## Submission Process

1. **Fork** the repository
2. **Create branch**: `git checkout -b add-[component-name]`
3. **Add component** following the file structure above
4. **Test** your component with real Bookla API
5. **Submit PR** with description of what your component does

## Component Categories

We're looking for:
- 🎨 **UI Components** - Booking widgets, calendars, forms
- 🔧 **Utility Components** - API helpers, validation, formatting
- 📊 **Analytics Components** - Charts, dashboards, reports
- 📱 **Mobile Components** - React Native, responsive designs

## Questions?

- 💬 Ask in [GitHub Discussions](https://github.com/bookla/components/discussions)
- 📧 Email us at dev@bookla.com