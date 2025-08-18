# financial-calcs

![npm](https://img.shields.io/npm/v/financial-calcs)
![npm downloads](https://img.shields.io/npm/dm/financial-calcs)
![build](https://github.com/cloudful-io/financial-calcs/actions/workflows/publish.yml/badge.svg)
![license](https://img.shields.io/npm/l/financial-calcs)

A lightweight, reusable TypeScript library to perform financial calculation.  This package contains **pure calculation functions** for:

- [Federal Employee Retirement System (FERS) Pension projection](./src/pension/README.md)
- [Retirement Savings projection](./src/retirement/README.md)
- [Social Security Benefit projection](./src/socialSecurity/README.md)

All functions are decoupled from UI logic and can be used in any TypeScript or JavaScript project.

---

## Installation

```bash
npm install financial-calcs
```

or with Yarn:

```bash
yarn add financial-calcs
```

---

## Notes

- All functions are **pure** and have no side effects.
- Ideal for use in React, Vue, Node.js, or any TypeScript/JavaScript environment.
- Works well for building projection tables, charts, or integrating into financial planning tools.

---

## Contributing

If you want to contribute:

1. Fork the repository
2. Make your changes in a separate branch
3. Add unit tests
4. Open a pull request

---

## License

MIT

