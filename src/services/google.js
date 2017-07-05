const cheerio = require('cheerio');
const path = require('path');
const _ = require('lodash');
const fs = require('fs');
const google = require('googleapis');
const googleAuth = require('google-auth-library');
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const drive = google.drive('v3');
const azure = require('azure-storage');
const fileService = azure.createFileService();
const blobService = azure.createBlobService();
const mime = require('mime');
const Promise = require("bluebird");
const streamBuffers = require('stream-buffers');
const slugify = require('speakingurl');
import Jimp from 'jimp';
import models from '../models';

const createContainerIfNotExists = Promise.promisify(blobService.createContainerIfNotExists).bind(blobService);
const createAppendBlobFromText = Promise.promisify(blobService.createAppendBlobFromText).bind(blobService);
const getBlobMetadata = Promise.promisify(blobService.getBlobMetadata).bind(blobService);

function retrieveAllFiles(auth, folder) {
    return new Promise((resolve, reject) => {
        var result = []
        var retrievePageOfFiles = function (err, resp) {
            result = result.concat(resp.files);
            var nextPageToken = resp.nextPageToken;
            if (nextPageToken) {
                request = drive.files.list({
                    auth: auth,
                    fields: 'nextPageToken, files(id, name, kind, mimeType, parents)',
                    'pageToken': nextPageToken
                }, retrievePageOfFiles);
            } else {
                resolve(result);
            }
        }

        var initialRequest = drive.files.list({
            auth: auth,
            fields: 'nextPageToken, files(id, name, kind, mimeType, parents)',
        }, retrievePageOfFiles);
    });

}

async function recurse(auth, root) {
    let files = await retrieveAllFiles(auth, root).map(f => {
        f.children = [];
        return f;
    });

    let fileDictionary = _.keyBy(files, (i) => i.id);
    for (let file of files) {
        let parentId = _.first(file.parents);
        let parent = fileDictionary[parentId];
        if (parent) {
            parent.children.push(fileDictionary[file.id]);
            if (file.parents && file.parents.indexOf(root) == -1) {
                file.parentSlug = slugify(parent.name);
            }
        }

        if (file.name.indexOf('L|') > -1) {
            file.name = file.name.split('L|')[1].trim();
            file.type = 'location';
        } else {
            if (file.mimeType == 'application/vnd.google-apps.folder') {
                if (file.parents && file.parents.indexOf(root) > -1) {
                    file.type = 'country';
                } else {
                    file.type = 'category';
                }
            } else if (file.mimeType == 'application/vnd.google-apps.document') {
                file.type = 'article';
            }
        }

        delete file.mimeType;
        delete file.kind;

        file.slug = slugify(file.name);
    }

    for (let key of _.keys(fileDictionary)) {
        if ((fileDictionary[key].parents || []).indexOf(root) === -1) {
            delete fileDictionary[key];
        }
    }



    return _.flatMap(fileDictionary).map((f) => {
        delete f.parents;
        return f;
    });
}

function recurse1(auth, root) {
    return new Promise((resolve, reject) => {
        retrieveAllFiles(auth, root).then((children) => {
            Promise.all(children.map((c, i) => {
                return retrieveAllFiles(auth, c.id).then((g) => {
                    children[i].children = g;
                    return g;
                });
            })).then(() => {
                resolve(children);
            })
        })
    });
}



function exportFile(auth, fileId) {
    return new Promise((resolve, reject) => {

        drive.files.export({
            auth,
            fileId,
            mimeType: "text/html"
        }, (e2, r2) => {
            const $ = cheerio.load(r2);

            // Transforming styles to full HTML elements
            $('[style]').each((i, e) => {
                const weight = $(e).css('font-weight');
                const textDecoration = $(e).css('text-decoration');
                const fontStyle = $(e).css('font-style');
                const verticalAlign = $(e).css('vertical-align');

                let pa = null;
                let ch = null;
                const wrap = (t) => {
                    let ch1 = $(t)
                    if (pa) {
                        if (ch) {
                            ch.append(ch1);
                        }
                        ch = ch1;
                    } else {
                        pa = ch1;
                        ch = ch1;
                    }
                }

                if (weight > 400) {
                    wrap('<strong />');
                }
                if (textDecoration == 'underline') {
                    wrap('<u />');
                }
                if (fontStyle == 'italic') {
                    wrap('<em />');
                }
                if (verticalAlign == 'super') {
                    wrap('<sup />');
                }
                if (verticalAlign == 'sub') {
                    wrap('<sub />');
                }

                if (pa && ch) {
                    let { parent, children } = e;
                    let c = $(children).clone();

                    ch.append(children);
                    $(e).replaceWith(pa);
                }
            });

            // passing images through filters
            let a = $('img').map((i, o) => {
                let src = o.attribs.src;
                return { src, obj: $(o) };
            });
            let promises = _.map(a, (i) => {
                return new Promise((_resolve, _reject) => {
                    Jimp.read(i.src, function (err, image) {
                        if (err) throw err;

                        let width = image.bitmap.width;
                        if (width > 700) {
                            width = 700;
                            let ratio = image.bitmap.width / image.bitmap.height;
                            let height = width * ratio;
                            image = image.scaleToFit(width, height);
                        }

                        if ((image.bitmap.width / image.bitmap.height) < Math.sqrt(5)) {
                            image = image.crop(0, 0, image.bitmap.width, image.bitmap.width / Math.sqrt(5));
                        } else {
                            image = image.scaleToFit(image.bitmap.width, image.bitmap.width / Math.sqrt(5));
                        }

                        image
                            //.resize(256, 256)            // resize
                            .quality(50)                 // set JPEG quality
                            .getBuffer('image/jpeg', (a, b) => {
                                let hash = image.hash();

                                createContainerIfNotExists('ri-images')
                                    .then((d) => {
                                        return createAppendBlobFromText('ri-images', `${hash}.jpg`, b, b.length);
                                    })
                                    .then((f) => {
                                        return getBlobMetadata('ri-images', `${hash}.jpg`);
                                    }).then((m) => {
                                        _resolve({
                                            newSrc: blobService.getUrl('ri-images', m.name),
                                            ...i
                                        });
                                    })
                            }); // save
                    });
                })
            });


            // Removing unnecessary spans
            $('* > span').each((i, e) => {
                let { parent, children } = e;
                let c = $(children).clone();
                $(e).replaceWith(c);
            });

            // Removing formatting from everything but images
            $('[style]:not(img)').each((i, e) => {
                delete e.attribs['id'];
                delete e.attribs['style'];
                delete e.attribs['name'];
            });

            // Removing formatting from images
            $('img').each((i, e) => e.attribs = { src: e.attribs.src, alt: e.attribs.alt });

            // Removing empty spans, ps and divs
            $('p > span:empty').remove();
            $('p:empty').remove();
            $('div:empty').remove();
            $('sup:empty').remove();
            $('sub:empty').remove();
            $('em:empty').remove();
            $('u:empty').remove();

            // Removing GDocs Comments
            $('div p a[id]').parent().parent().remove();
            $('sup a[id]').remove();

            $('p em').each((i, e) => {
                if ($(e).parent().prev().has('img')) {
                    $(e).addClass('caption');
                }
            })


            Promise.all(promises).then((p) => {

                p.forEach((v) => {
                    $(`[src='${v.src}']`).attr('src', v.newSrc);
                })
                resolve($('body').html());
            });
        });
    });
}

function listFiles(auth, oid) {
    return new Promise((resolve, reject) => {
        //const folder = "0B-lKSEVt5tJeamY2d3ZBRlJEMXc";
        //const folder = "0B-lKSEVt5tJeTVJ3WW1RSVFGaUU";
        const folder = "0B-lKSEVt5tJebk1aM3B6N1pJQjQ";

        var initialRequest = drive.files.list({
            auth: auth,
            'q': `'${folder}' in parents`
        }, (e, r) => {
            ;
            const { files } = r;
            const fileId = files[0].id;
            oid = oid || files[0].id;

            console.log(fileId);

            resolve(oid);
        });
    }).then(o => exportFile(auth, o));
}

const root = path.dirname(path.join(__dirname, '..'));
const secrets = path.join(root, 'secrets.json');

function loadKey() {
    return new Promise((res, rej) => {
        if (process.env.GOOGLE_SECRETS) {
            var key = JSON.parse(process.env.GOOGLE_SECRETS);
            var jwtClient = new google.auth.JWT(
                key.client_email,
                null,
                key.private_key,
                SCOPES,
                null
            );

            jwtClient.authorize(function (err, tokens) {
                if (err) {
                    console.log(err);

                    rej(err);

                }
                res(jwtClient);

            });
        } else {
            fs.readFile(secrets, (err, content) => {
                if (err) {
                    console.log('Error loading client secret file: ' + err);
                    rej(err);
                }

                var key = JSON.parse(content);
                var jwtClient = new google.auth.JWT(
                    key.client_email,
                    null,
                    key.private_key,
                    SCOPES,
                    null
                );

                jwtClient.authorize(function (err, tokens) {
                    if (err) {
                        console.log(err);

                        rej(err);

                    }
                    res(jwtClient);
                });
            });
        }
    });
}

export default {
    utils: {
        generateDocument: (id) => {
            return loadKey()
                .then((auth) => exportFile(auth, id).then((h) => {
                    const $ = cheerio.load(h);
                    const title = $('.title').remove();
                    const subtitle = $('.subtitle').remove();
                    const hero = $('img', subtitle).remove();
                    return {
                        slug: slugify(title.html()),
                        title: title.html(),
                        lede: subtitle.html(),
                        hero: hero.attr('src'),
                        body: $('body').html()
                    }
                }));
        }
    },
    driveService: (db) => ({
        find: (params) => {
            return loadKey()
                .then((k) => {
                    return recurse(k, "0B-lKSEVt5tJeamY2d3ZBRlJEMXc").then(async (files) => {
                        let countries = files;
                        const removeChildren = (c) => {
                            delete c.children;
                            return c;
                        };

                        let firstLevel = _.flatten(countries.map((c) => c.children));
                        let secondLevel = _.flatten(firstLevel.map((c) => c.children));
                        let thirdLevel = _.flatten(secondLevel.map((c) => c.children));

                        const { Country, Category, Article, Location } = models(db);
                        const importCategories = async (categoryFolder) => {
                            let obj = await Category.findOne({ slug: categoryFolder.slug });
                            const { name, slug } = categoryFolder;

                            if (!obj) {
                                obj = new Category({ name, slug });
                            }
                            Object.assign(obj, { name, slug });

                            await obj.save();
                        }
                        const generateCategoryContent = async (subFolder) => {
                            let category = await Category.findOne({ slug: subFolder.slug });
                            let articles = [];
                            for (let articleFile of subFolder.children) {
                                let article = await Article.findOne({ slug: articleFile.slug });
                                articles.push(article);

                                if (articleFile.slug && !article) {
                                    console.log(articleFile.name, 'Is Missing!')
                                }
                            }

                            return {
                                category,
                                articles
                            };
                        };

                        for (let countryFolder in countries) {
                            const { name, slug } = countryFolder;

                            let obj = await Country.findOne({ slug: countryFolder.slug });
                            if (!obj) {
                                obj = new Country({ name, slug });
                            }
                            Object.assign(obj, { name, slug });

                            await obj.save();
                        }

                        for (let categoryOrLocation of firstLevel) {
                            if (categoryOrLocation.type == 'category') {
                                await importCategories(categoryOrLocation)

                            } else if (categoryOrLocation.type == 'location') {
                                let obj = await Location.findOne({ slug: categoryOrLocation.slug });
                                const { name, slug } = categoryOrLocation;

                                if (!obj) {
                                    obj = new Location({ name, slug });
                                }
                                Object.assign(obj, { name, slug });

                                await obj.save();
                            }
                        }

                        for (let categoryOrFile of secondLevel) {
                            if (categoryOrFile.type == 'category') {
                                await importCategories(categoryOrFile)
                            }
                        }

                        let articles = _.flatten(secondLevel.concat(thirdLevel)).filter(c => c.type == 'article');

                        for (let articleFile of articles) {
                            let html = await exportFile(k, articleFile.id);

                            const $ = cheerio.load(html);
                            const title = $('.title').remove();
                            const subtitle = $('.subtitle').remove();
                            const hero = $('img', subtitle).remove();
                            let articlePayload = {
                                slug: slugify(articleFile.name),
                                title: title.html(),
                                lede: subtitle.html(),
                                hero: hero.attr('src'),
                                body: $('body').html()
                            };


                            let article = await Article.findOne({ slug: articlePayload.slug })
                            if (!article) {
                                article = new Article(articlePayload);
                            }
                            Object.assign(article, { ...articlePayload });

                            await article.save();
                        }




                        let content = [];
                        let locations = [];
                        for (let countryFolder of countries) {
                            let country = await Country.findOne({ slug: countryFolder.slug });
                            country.content = [];
                            for (let subFolder of countryFolder.children) {
                                if (subFolder.type == 'category') {
                                    const { category, articles } = await generateCategoryContent(subFolder)

                                    country.content.push({
                                        category: category._id,
                                        articles: articles.filter(_.identity).map(a => a._id)
                                    });
                                } else if (subFolder.type == 'location') {
                                    let location =  await Location.findOne({ slug: subFolder.slug });
                                    if (!location) {
                                        console.log('didnt find', subFolder.slug);
                                        continue;
                                    }
                                    let locationPayload = {
                                        location: location._id,
                                        content: []
                                    }
                                    for (let subSubFolder of subFolder.children) {
                                        const { category, articles } = await generateCategoryContent(subSubFolder)

                                        locationPayload.content.push({
                                            category: category._id,
                                            articles: articles.filter(_.identity).map(a => a._id)
                                        });
                                    }

                                    console.log(locationPayload);

                                    country.locations.push(locationPayload);
                                }
                            }
                            await country.save();
                        }

                        return countries;
                    });
                });
        },
        get: (id, params) => {
            return loadKey()
                .then((k) => retrieveAllFiles(k, id));
        }
    })
};

