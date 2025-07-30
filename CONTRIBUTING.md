This action uses TypeScript and requires Node.js and pnpm to generate the JavaScript files. To make it easier, we have a [workflow](./.github/workflows/generate-js.yml) that can do this for you automatically. Here is how to use it:

1. [Fork](https://github.com/keiyoushi/issue-moderator-action/fork) the repository.
1. Open your fork, navigate to the Actions tab, and enable them.
1. In your fork, navigate to `Settings > Actions > General > Workflow permissions`. You need to do 2 things here: enable write access for `GITHUB_TOKEN` and allow GitHub Actions to create Pull Requests.
1. Create a new branch for your feature or bugfix. We will be using branch `feat-1` as an example.
1. Push your changes to the branch.
1. After a few minutes, the `github-actions/generate-js/feat-1` branch will be created in your fork. It will contain generated JavaScript files. There will also be a Pull Request in your repository. There is no need to merge it.
1. Go to the Settings tab in your fork and change the default branch to `github-actions/generate-js/feat-1`. This way, you can test your changes in your fork.
1. You can now try opening test issues in your fork to see how your changes work.
1. You can keep pushing your changes to the `feat-1` branch. The changes will be applied to the `github-actions/generate-js/feat-1` branch automatically.
1. Once you are ready to propose your changes, you can open a Pull Request from the `github-actions/generate-js/feat-1` branch to our `main` branch. You can still push changes to the `feat-1` branch, and your Pull Request will be updated automatically with the changes after a few minutes.

Keep in mind that the flow above is described for cases when you create a fork to contribute to this repository. If you maintain your own fork, changing the default branch is not desirable. However, the workflow can still help you with keeping your branches up-to-date. Whenever something is pushed to a branch, the workflow checks if the JavaScript files need to be updated. If so, it opens a Pull Request that you can merge.
