# Sats-Wagmi Contributing Guide

Hello!, I am very excited that you are interested in contributing to sats-wagmi. However, before submitting your contribution, be sure to take a moment and read the following guidelines.

- [Extraction request guidelines](#pull-request-guidelines)
- [Development Setup](#development-setup)
- [Breaking Changes](#breaking-changes)
- [Becoming a maintainer](#becoming-a-maintainer)

### Tooling

- [PNPM](https://pnpm.io/) to manage packages and dependencies
- [Tsup](https://tsup.egoist.sh/) to bundle packages
- [Storybook](https://storybook.js.org/) for rapid UI component development and
  testing
- [Testing Library](https://testing-library.com/) for testing components and
  hooks
- [Changeset](https://github.com/atlassian/changesets) for changes
  documentation, changelog generation, and release management.

### Commit Convention

Before you create a Pull Request, please check whether your commits comply with
the commit conventions used in this repository.

When you create a commit we kindly ask you to follow the convention
`category(scope or module): message` in your commit message while using one of
the following categories:

- `feat / feature`: all changes that introduce completely new code or new
  features
- `fix`: changes that fix a bug (ideally you will additionally reference an
  issue if present)
- `refactor`: any code related change that is not a fix nor a feature
- `docs`: changing existing or creating new documentation (i.e. README, docs for
  usage of a lib or cli usage)
- `build`: all changes regarding the build of the software, changes to
  dependencies or the addition of new dependencies
- `test`: all changes regarding tests (adding new tests or changing existing
  ones)
- `ci`: all changes regarding the configuration of continuous integration (i.e.
  github actions, ci system)
- `chore`: all changes to the repository that do not fit into any of the above
  categories

  e.g. `feat(components): add new prop to the avatar component`

If you are interested in the detailed specification you can visit
https://www.conventionalcommits.org/ or check out the
[Angular Commit Message Guidelines](https://github.com/angular/angular/blob/22b96b9/CONTRIBUTING.md#-commit-message-guidelines).

## Pull Request Guidelines

- The `main` branch is basically a snapshot of the latest stable version. All development must be done in dedicated branches.
- Make sure that Github Actions are green
- It is good to have multiple small commits while working on the PR. We'll let GitHub squash it automatically before the merge.
- If you add a new feature:
  - Add the test case that accompanies it.
  - Provide a compelling reason to add this feature in a issue, which you should link to your PR (# xxxx).
- If you correct an error:
  - If you are solving a special problem, add (fix #xxxx [, # xxx]) (# xxxx is the problem identification) in your PR title for a better launch record, for example fix button style (fix # 3899).
  - Provide a detailed description of the error in the PR. Favorite live demo.
  - Add the appropriate test coverage, if applicable.

### Steps to PR

1. Fork of the repository and clone your fork

2. Create a new branch out of the `main` branch. We follow the convention
   `[type/scope]`. For example `fix/dropdown-hook` or `docs/menu-typo`. `type`
   can be either `docs`, `fix`, `feat`, `build`, or any other conventional
   commit type. `scope` is just a short id that describes the scope of work.

3. Make and commit your changes following the
   [commit convention](#commit-convention).
   As you develop, you can run `pnpm build --filter=<module>` and
   `pnpm test packages/<pkg>` e.g. `pnpm build --filter=components & pnpm test packages/components` to make sure everything works as expected.

   > To know more about the `--filter` option, please check the turborepo [docs](https://turborepo.org/docs/core-concepts/filtering).

4. Run `pnpm changeset` to create a detailed description of your changes. This
   will be used to generate a changelog when we publish an update.
   [Learn more about Changeset](https://github.com/atlassian/changesets/tree/master/packages/cli).
   Please note that you might have to run `git fetch origin main:main` (where
   origin will be your fork on GitHub) before `pnpm changeset` works.

   You can also create the changeset through you github PR. We have a github changeset-bot
   that will provide you with status on the changetset and provide you with the action
   to create one (in case is necessary).

> If you made minor changes like CI config, prettier, etc, you can run
> `pnpm changeset add --empty` to generate an empty changeset file to document
> your changes. If you use the github bot, you can just procced ignoring the bot and to merge the PR.

## Development Setup

After cloning the repository, execute the following commands in the root folder:

1. Install dependencies

```bash
pnpm i

#or

pnpm install
```

We use [Turbo Repo](https://turborepo.org/) for the project management.

2. If you will be working on the components source code, you can use the following command to start the storybook dev server:

```bash
## Start the storybook of core components
pnpm dev

```

3. Create a branch for your feature or fix:

```bash
# Move into a new branch for your feature
git checkout -b feat/thing
```

```bash
# Move into a new branch for your fix
git checkout -b fix/something
```

4. If your code passes all the tests, then push your feature/fix branch:

All commits that fix bugs or add features need a test.
You can run the nest command for component specific tests.

5. Be sure the package builds.

```
# Build current code
pnpm build # or npm run build
```

> Note: ensure your version of Node is 18 or higher to run scripts

6. Send your pull request:

- Send your pull request to the `main` branch
- Your pull request will be reviewed by the maintainers and the maintainers will decide if it is accepted or not
- Once the pull request is accepted, the maintainers will merge it to the `main` branch

## Breaking changes

Breaking changes should be accompanied with deprecations of removed functionality. The deprecated APIs themselves should not be removed until the minor release after that.
