# Contributing

All changes reach `main` through a pull request. You can't push to `main` directly.

## Making a change

1. Pick an issue, or open one, and assign yourself so nobody duplicates the work.

2. Get the latest code and create a branch:

   ```sh
   git checkout main
   git pull
   git checkout -b add-contact-page
   ```

   Name the branch after what it does.

3. Make your change and commit it:

   ```sh
   git add .
   git commit -m "Add contact page"
   ```

4. Open `website.html` in your browser and check that your change works.

5. Push your branch:

   ```sh
   git push -u origin add-contact-page
   ```

6. Open a pull request on GitHub and fill in the template.

7. Merge once the automatic check passes. Then delete the branch.

## Tips

- Keep pull requests small. They get reviewed faster and cause fewer conflicts.
- If `main` has moved on while you worked, run `git pull origin main` on your branch and fix any conflicts.
